/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */
import type { AnnotationFeatureSnapshot } from '@apollo-annotation/mst'
import { gff3ToAnnotationFeature } from '@apollo-annotation/shared'
import type { GFF3Feature } from '@gmod/gff'
import type { PluggableElementType } from '@jbrowse/core/pluggableElementTypes'
import type DisplayType from '@jbrowse/core/pluggableElementTypes/DisplayType'
import { getContainingView, getSession } from '@jbrowse/core/util'
import type { Feature } from '@jbrowse/core/util/simpleFeature'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

import { CollaborationServerDriver } from '../BackendDrivers'
import { CreateApolloAnnotation } from '../components/CreateApolloAnnotation'
import { Apollo as ApolloIcon } from '../menus/Icons'
import type { ApolloSessionModel } from '../session'

function simpleFeatureToGFF3Feature(
  feature: Feature,
  refSeqId: string,
): GFF3Feature {
  const children = feature.get('subfeatures')
  const gff3Feature = [
    {
      start: feature.get('start') + 1,
      end: feature.get('end'),
      seq_id: refSeqId,
      source: feature.get('source') ?? null,
      type: feature.get('type') ?? null,
      score: feature.get('score') ?? null,
      strand: feature.get('strand')
        ? // eslint-disable-next-line unicorn/no-nested-ternary
          feature.get('strand') === 1
          ? '+'
          : '-'
        : null,
      phase:
        feature.get('phase') !== null || feature.get('phase') !== undefined
          ? (feature.get('phase') as string)
          : null,
      attributes: convertFeatureAttributes(feature),
      derived_features: [],
      child_features: children
        ? children.map((x: Feature) => simpleFeatureToGFF3Feature(x, refSeqId))
        : [],
    },
  ]
  return gff3Feature
}

export function jbrowseFeatureToAnnotationFeature(
  feature: Feature,
  refSeqId: string,
): AnnotationFeatureSnapshot {
  return gff3ToAnnotationFeature(simpleFeatureToGFF3Feature(feature, refSeqId))
}

const fieldsToSkip = new Set([
  'start',
  'end',
  'type',
  'strand',
  'refName',
  'subfeatures',
  'derived_features',
  'phase',
  'source',
  'score',
  'parent',
  // From https://github.com/GMOD/jbrowse-components/blob/ab3126374367f43d01038d6d2e86d8db03c4d8d8/packages/core/src/BaseFeatureWidget/BaseFeatureDetail/Attributes.tsx#L12-L24
  '__jbrowsefmt',
  'length',
  'position',
  'uniqueId',
  'exonFrames',
  'parentId',
  'thickStart',
  'thickEnd',
  '_lineHash',
])

const fieldsToRename: Record<string, string | undefined> = {
  id: 'gff_id',
  name: 'gff_name',
  alias: 'gff_alias',
  target: 'gff_target',
  gap: 'gff_gap',
  derives_from: 'gff_derives_from',
  note: 'gff_note',
  dbxref: 'gff_dbxref',
  ontology_term: 'gff_ontology_term',
  is_circular: 'gff_is_circular',
}

function convertFeatureAttributes(feature: Feature): Record<string, string[]> {
  const attributes: Record<string, string[]> = {}

  for (const [originalKey, value] of Object.entries(feature.toJSON())) {
    if (fieldsToSkip.has(originalKey)) {
      continue
    }
    const renamedKey = fieldsToRename[originalKey]
    const key = renamedKey ?? originalKey
    attributes[key] = Array.isArray(value) ? value.map(String) : [String(value)]
  }
  return attributes
}

function getTopLevelSimpleFeature(feature: Feature) {
  let topLevel = feature
  let parent = feature.get('parent')
  while (parent) {
    topLevel = parent
    parent = parent.get('parent')
  }
  return topLevel
}

export function annotationFromJBrowseFeature(
  pluggableElement: PluggableElementType,
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
    }))
    .views((self) => {
      const superContextMenuItems = self.contextMenuItems

      return {
        contextMenuItems() {
          const session = getSession(self)
          const assembly = self.getAssembly()
          const region = self.getFirstRegion()
          const feature = self.contextMenuFeature
          if (!feature) {
            return superContextMenuItems()
          }
          const topLevelFeature = getTopLevelSimpleFeature(feature)
          return [
            ...superContextMenuItems(),
            {
              label: 'Create Apollo annotation',
              icon: ApolloIcon,
              onClick: async () => {
                const backendDriver = (
                  session as unknown as ApolloSessionModel
                ).apolloDataStore.getBackendDriver(region.assemblyName)
                let refSeqId = region.refName
                if (backendDriver instanceof CollaborationServerDriver) {
                  const backendRefSeqId = await backendDriver.getRefSeqId(
                    region.assemblyName,
                    region.refName,
                  )
                  if (!backendRefSeqId) {
                    throw new Error(
                      `Could not find refSeq for "${region.refName}"`,
                    )
                  }
                  refSeqId = backendRefSeqId
                }
                const annotationFeature = jbrowseFeatureToAnnotationFeature(
                  topLevelFeature,
                  refSeqId,
                )
                session.queueDialog((doneCallback) => [
                  CreateApolloAnnotation,
                  {
                    session,
                    handleClose: () => {
                      doneCallback()
                    },
                    annotationFeature,
                    assembly,
                    refSeqId,
                    region,
                  },
                ])
              },
            },
          ]
        },
      }
    })

  ;(pluggableElement as DisplayType).stateModel = newStateModel
  return pluggableElement
}
