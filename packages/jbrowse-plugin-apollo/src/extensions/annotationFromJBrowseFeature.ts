/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */
import DisplayType from '@jbrowse/core/pluggableElementTypes/DisplayType'
import PluggableElementBase from '@jbrowse/core/pluggableElementTypes/PluggableElementBase'
import AddIcon from '@mui/icons-material/Add'
import {
  AbstractSessionModel,
  doesIntersect2,
  getContainingView,
  getSession,
} from '@jbrowse/core/util'
import { Assembly } from '@jbrowse/core/assemblyManager/assembly'
import { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'
import { AnnotationFeatureSnapshot } from '@apollo-annotation/mst'
import ObjectID from 'bson-objectid'
import { SimpleFeatureSerializedNoId } from '@jbrowse/core/util/simpleFeature'
import { CreateApolloAnnotation } from '../components/CreateApolloAnnotation'

// Map Jbrowse SimpleFeature to Apollo AnnotationFeature. This is similar to gff3ToAnnotationFeature.ts
function simpleFeatureToAnnotationFeature(
  feature: SimpleFeatureSerializedNoId,
  refSeqId: string,
  featureIds: string[],
) {
  if (!feature.type) {
    throw new Error(`feature does not have type: ${JSON.stringify(feature)}`)
  }

  const { end, start, strand } = feature
  const f: AnnotationFeatureSnapshot = {
    _id: ObjectID().toHexString(),
    refSeq: refSeqId,
    min: start,
    max: end,
    type: feature.type,
    strand: strand as 1 | -1 | undefined,
  }
  const convertedChildren = convertSubFeatures(feature, refSeqId, featureIds)

  if (convertedChildren) {
    f.children = convertedChildren
  }

  f.attributes = convertFeatureAttributes(feature)
  featureIds.push(f._id)
  return f
}

function convertFeatureAttributes(
  feature: SimpleFeatureSerializedNoId,
): Record<string, string[]> {
  const attributes: Record<string, string[]> = {}
  const defaultFields = new Set([
    'start',
    'end',
    'type',
    'strand',
    'refName',
    'subfeatures',
    'derived_features',
    'phase',
  ])
  for (const [key, value] of Object.entries(feature)) {
    if (defaultFields.has(key)) {
      continue
    }
    attributes[key] = Array.isArray(value) ? value.map(String) : [String(value)]
  }
  return attributes
}

function convertSubFeatures(
  feature: SimpleFeatureSerializedNoId,
  refSeqId: string,
  featureIds: string[],
) {
  if (!feature.subfeatures) {
    return
  }
  const children: Record<string, AnnotationFeatureSnapshot> = {}
  const cdsFeatures: SimpleFeatureSerializedNoId[] = []
  for (const subFeature of feature.subfeatures) {
    if (
      subFeature.type === 'three_prime_UTR' ||
      subFeature.type === 'five_prime_UTR' ||
      subFeature.type === 'intron' ||
      subFeature.type === 'start_codon' ||
      subFeature.type === 'stop_codon'
    ) {
      continue
    }
    if (subFeature.type === 'CDS') {
      cdsFeatures.push(subFeature)
    } else {
      const child = simpleFeatureToAnnotationFeature(
        subFeature,
        refSeqId,
        featureIds,
      )
      children[child._id] = child
    }
  }
  const processedCDS =
    cdsFeatures.length > 0 ? processCDS(cdsFeatures, refSeqId, featureIds) : []
  for (const cds of processedCDS) {
    children[cds._id] = cds
  }

  if (Object.keys(children).length > 0) {
    return children
  }
  return
}

function getFeatureMinMax(
  cdsFeatures: SimpleFeatureSerializedNoId[],
): [number, number] {
  const mins = cdsFeatures.map((f) => f.start)
  const maxes = cdsFeatures.map((f) => f.end)
  const min = Math.min(...mins)
  const max = Math.max(...maxes)
  return [min, max]
}

function processCDS(
  cdsFeatures: SimpleFeatureSerializedNoId[],
  refSeqId: string,
  featureIds: string[],
): AnnotationFeatureSnapshot[] {
  const annotationFeatures: AnnotationFeatureSnapshot[] = []
  const cdsWithIds: Record<string, SimpleFeatureSerializedNoId[]> = {}
  const cdsWithoutIds: SimpleFeatureSerializedNoId[] = []

  for (const cds of cdsFeatures) {
    if ('id' in cds) {
      const id = cds.id as string
      cdsWithIds[id] = cdsWithIds[id] ?? []
      cdsWithIds[id].push(cds)
    } else {
      cdsWithoutIds.push(cds)
    }
  }

  for (const [, cds] of Object.entries(cdsWithIds)) {
    const [min, max] = getFeatureMinMax(cds)
    const f: AnnotationFeatureSnapshot = {
      _id: ObjectID().toHexString(),
      refSeq: refSeqId,
      min,
      max,
      type: 'CDS',
      strand: cds[0].strand as 1 | -1 | undefined,
      attributes: convertFeatureAttributes(cds[0]),
    }
    featureIds.push(f._id)
    annotationFeatures.push(f)
  }

  if (cdsWithoutIds.length === 0) {
    return annotationFeatures
  }

  // If we don't have ID CDS features then check If there are overlapping CDS
  // features, If they're not overlapping then assume it's a single CDS feature
  const sortedCDSLocations = cdsWithoutIds.sort(
    (cdsA, cdsB) => cdsA.start - cdsB.start,
  )
  const overlapping = sortedCDSLocations.some((loc, idx) => {
    const nextLoc = sortedCDSLocations.at(idx + 1)
    if (!nextLoc) {
      return false
    }
    return doesIntersect2(loc.start, loc.end, nextLoc.start, nextLoc.end)
  })
  // If no overlaps, assume it's a single CDS feature
  if (!overlapping) {
    const [min, max] = getFeatureMinMax(sortedCDSLocations)
    const f: AnnotationFeatureSnapshot = {
      _id: ObjectID().toHexString(),
      refSeq: refSeqId,
      min,
      max,
      type: 'CDS',
      strand: sortedCDSLocations[0].strand as 1 | -1 | undefined,
      attributes: convertFeatureAttributes(sortedCDSLocations[0]),
    }
    featureIds.push(f._id)
    annotationFeatures.push(f)
  }

  const groupedLocations: SimpleFeatureSerializedNoId[][] = []
  for (const location of cdsWithoutIds) {
    const lastGroup = groupedLocations.at(-1)
    if (!lastGroup) {
      groupedLocations.push([location])
      continue
    }
    const overlaps = lastGroup.some((lastGroupLoc) =>
      doesIntersect2(
        /* eslint-disable @typescript-eslint/no-non-null-assertion */
        lastGroupLoc.start,
        lastGroupLoc.end,
        location.start,
        location.end,
        /* eslint-enable @typescript-eslint/no-non-null-assertion */
      ),
    )
    if (overlaps) {
      groupedLocations.push([location])
    } else {
      lastGroup.push(location)
    }
  }
  for (const group of groupedLocations) {
    const [min, max] = getFeatureMinMax(group)
    const f: AnnotationFeatureSnapshot = {
      _id: ObjectID().toHexString(),
      refSeq: refSeqId,
      min,
      max,
      type: 'CDS',
      strand: group[0].strand as 1 | -1 | undefined,
      attributes: convertFeatureAttributes(group[0]),
    }
    featureIds.push(f._id)
    annotationFeatures.push(f)
  }

  return annotationFeatures
}

export function annotationFromJBrowseFeature(
  pluggableElement: PluggableElementBase,
) {
  if (pluggableElement.name !== 'LinearBasicDisplay') {
    return pluggableElement
  }
  const { stateModel } = pluggableElement as DisplayType

  const newStateModel = stateModel
    .views((self) => ({
      getFirstRegion() {
        const lgv = getContainingView(self) as unknown as LinearGenomeViewModel
        return lgv.dynamicBlocks.contentBlocks[0]
      },
      getAssembly() {
        const firstRegion = self.getFirstRegion()
        const session = getSession(self)
        const { assemblyManager } = session
        const { assemblyName } = firstRegion
        const assembly = assemblyManager.get(assemblyName)
        if (!assembly) {
          throw new Error(`Could not find assembly named ${assemblyName}`)
        }
        return assembly
      },
      getRefSeqId(assembly: Assembly) {
        const firstRegion = self.getFirstRegion()
        const { refName } = firstRegion
        const { refNameAliases } = assembly
        if (!refNameAliases) {
          throw new Error(`Could not find aliases for ${assembly.name}`)
        }
        const newRefNames = [...Object.entries(refNameAliases)]
          .filter(([id, refName]) => id !== refName)
          .map(([id, refName]) => ({
            _id: id,
            name: refName ?? '',
          }))
        const refSeqId = newRefNames.find((item) => item.name === refName)?._id
        if (!refSeqId) {
          throw new Error(`Could not find refSeqId named ${refName}`)
        }
        return refSeqId
      },
      getAnnotationFeature(assembly: Assembly) {
        // Map SimpleFeature to Apollo AnnotationFeature
        const feature: SimpleFeatureSerializedNoId =
          self.contextMenuFeature.data
        const refSeqId = self.getRefSeqId(assembly)
        const featureIds: string[] = []
        return simpleFeatureToAnnotationFeature(feature, refSeqId, featureIds)
      },
    }))
    .views((self) => {
      const superContextMenuItems = self.contextMenuItems
      const session = getSession(self)
      const assembly = self.getAssembly()

      return {
        contextMenuItems() {
          const feature = self.contextMenuFeature
          if (!feature) {
            return superContextMenuItems()
          }
          return [
            ...superContextMenuItems(),
            {
              label: 'Create Apollo annotation',
              icon: AddIcon,
              onClick: () => {
                ;(session as unknown as AbstractSessionModel).queueDialog(
                  (doneCallback) => [
                    CreateApolloAnnotation,
                    {
                      session,
                      handleClose: () => {
                        doneCallback()
                      },
                      annotationFeature: self.getAnnotationFeature(assembly),
                      assembly,
                    },
                  ],
                )
              },
            },
          ]
        },
      }
    })

  ;(pluggableElement as DisplayType).stateModel = newStateModel
  return pluggableElement
}
