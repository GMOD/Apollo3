/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */
import { type AnnotationFeatureSnapshot } from '@apollo-annotation/mst'
import { gff3ToAnnotationFeature } from '@apollo-annotation/shared'
import { type GFF3Feature } from '@gmod/gff'
import { type Assembly } from '@jbrowse/core/assemblyManager/assembly'
import { type PluggableElementType } from '@jbrowse/core/pluggableElementTypes'
import type DisplayType from '@jbrowse/core/pluggableElementTypes/DisplayType'
import {
  type AbstractSessionModel,
  getContainingView,
  getSession,
} from '@jbrowse/core/util'
import { type Feature } from '@jbrowse/core/util/simpleFeature'
import { type LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'
import AddIcon from '@mui/icons-material/Add'

import { CreateApolloAnnotation } from '../components/CreateApolloAnnotation'

function simpleFeatureToGFF3Feature(
  feature: Feature,
  refSeqId: string,
): GFF3Feature {
  // eslint-disable-next-line unicorn/prefer-structured-clone
  const xfeature = JSON.parse(JSON.stringify(feature))
  const children = xfeature.subfeatures
  const gff3Feature = [
    {
      start: (xfeature.start as number) + 1,
      end: xfeature.end as number,
      seq_id: refSeqId,
      source: xfeature.source ?? null,
      type: xfeature.type ?? null,
      score: xfeature.score ?? null,
      strand: xfeature.strand ? (xfeature.strand === 1 ? '+' : '-') : null,
      phase:
        xfeature.phase !== null || xfeature.phase !== undefined
          ? (xfeature.phase as string)
          : null,
      attributes: convertFeatureAttributes(xfeature),
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

function convertFeatureAttributes(feature: Feature): Record<string, string[]> {
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
    'source',
    'score',
  ])
  for (const [key, value] of Object.entries(feature)) {
    if (defaultFields.has(key)) {
      continue
    }
    attributes[key] = Array.isArray(value) ? value.map(String) : [String(value)]
  }
  return attributes
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
            name: refName,
          }))
        const refSeqId = newRefNames.find((item) => item.name === refName)?._id
        if (!refSeqId) {
          throw new Error(`Could not find refSeqId named ${refName}`)
        }
        return refSeqId
      },
      getAnnotationFeature(assembly: Assembly) {
        const refSeqId = self.getRefSeqId(assembly)
        const sfeature: Feature = self.contextMenuFeature.data
        return jbrowseFeatureToAnnotationFeature(sfeature, refSeqId)
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
                      refSeqId: self.getRefSeqId(assembly),
                      region,
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
