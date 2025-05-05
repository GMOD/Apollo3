/* eslint-disable @typescript-eslint/no-unnecessary-condition */

import {
  type AnnotationFeature,
  type TranscriptPartCoding,
} from '@apollo-annotation/mst'
import type PluginManager from '@jbrowse/core/PluginManager'
import { type AnyConfigurationSchemaType } from '@jbrowse/core/configuration/configurationSchema'
import {
  type AbstractSessionModel,
  doesIntersect2,
  getFrame,
} from '@jbrowse/core/util'
import { autorun, observable } from 'mobx'
import { addDisposer, isAlive } from 'mobx-state-tree'

import { type ApolloSessionModel } from '../../session'
import { geneGlyph } from '../glyphs'

import { baseModelFactory } from './base'

export interface LayoutRow {
  rowNum: number
  feature: AnnotationFeature
  cds: TranscriptPartCoding | null
}

export function layoutsModelFactory(
  pluginManager: PluginManager,
  configSchema: AnyConfigurationSchemaType,
) {
  const BaseLinearApolloSixFrameDisplay = baseModelFactory(
    pluginManager,
    configSchema,
  )

  return BaseLinearApolloSixFrameDisplay.named(
    'LinearApolloSixFrameDisplayLayouts',
  )
    .props({
      featuresMinMaxLimit: 500_000,
    })
    .volatile(() => ({
      seenFeatures: observable.map<string, AnnotationFeature>(),
    }))
    .views((self) => ({
      get featuresMinMax() {
        const { assemblyManager } =
          self.session as unknown as AbstractSessionModel
        return self.lgv.displayedRegions.map((region) => {
          const assembly = assemblyManager.get(region.assemblyName)
          let min: number | undefined
          let max: number | undefined
          const { end, refName, start } = region
          for (const [, feature] of self.seenFeatures) {
            if (
              refName !== assembly?.getCanonicalRefName(feature.refSeq) ||
              !doesIntersect2(start, end, feature.min, feature.max) ||
              feature.length > self.featuresMinMaxLimit
            ) {
              continue
            }
            if (min === undefined) {
              ;({ min } = feature)
            }
            if (max === undefined) {
              ;({ max } = feature)
            }
            if (feature.minWithChildren < min) {
              ;({ min } = feature)
            }
            if (feature.maxWithChildren > max) {
              ;({ max } = feature)
            }
          }
          if (min !== undefined && max !== undefined) {
            return [min, max]
          }
          return
        })
      },
      getGlyph(_feature: AnnotationFeature) {
        return geneGlyph
      },
    }))
    .actions((self) => ({
      addSeenFeature(feature: AnnotationFeature) {
        self.seenFeatures.set(feature._id, feature)
      },
      deleteSeenFeature(featureId: string) {
        self.seenFeatures.delete(featureId)
      },
    }))
    .views((self) => ({
      get featureLayouts() {
        const { assemblyManager } =
          self.session as unknown as AbstractSessionModel
        return self.lgv.displayedRegions.map((region, idx) => {
          const assembly = assemblyManager.get(region.assemblyName)
          const featureLayout = new Map<number, LayoutRow[]>()
          const minMax = self.featuresMinMax[idx]
          if (!minMax) {
            return featureLayout
          }
          const { end, refName, start } = region
          for (const [id, feature] of self.seenFeatures.entries()) {
            if (!isAlive(feature)) {
              self.deleteSeenFeature(id)
              continue
            }
            if (
              refName !== assembly?.getCanonicalRefName(feature.refSeq) ||
              !doesIntersect2(start, end, feature.min, feature.max)
            ) {
              continue
            }
            const { featureTypeOntology } =
              self.session.apolloDataStore.ontologyManager
            if (!featureTypeOntology) {
              throw new Error('featureTypeOntology is undefined')
            }
            if (feature.looksLikeGene) {
              const rowNum = feature.strand == 1 ? 4 : 5
              if (!featureLayout.get(rowNum)) {
                featureLayout.set(rowNum, [])
              }
              const layoutRow = featureLayout.get(rowNum)
              layoutRow?.push({ rowNum, feature, cds: null })
              const { children } = feature
              if (!children) {
                continue
              }
              for (const [, child] of children) {
                if (featureTypeOntology.isTypeOf(child.type, 'transcript')) {
                  const {
                    cdsLocations,
                    strand,
                    children: childrenOfmRNA,
                  } = child
                  if (childrenOfmRNA) {
                    for (const [, exon] of childrenOfmRNA) {
                      if (!featureTypeOntology.isTypeOf(exon.type, 'exon')) {
                        continue
                      }
                      const rowNum = exon.strand == 1 ? 4 : 5
                      const layoutRow = featureLayout.get(rowNum)
                      layoutRow?.push({ rowNum, feature: exon, cds: null })
                    }
                  }
                  for (const cdsRow of cdsLocations) {
                    for (const cds of cdsRow) {
                      let rowNum: number = getFrame(
                        cds.min,
                        cds.max,
                        strand ?? 1,
                        cds.phase,
                      )
                      rowNum = rowNum < 0 ? -1 * rowNum + 5 : rowNum
                      if (!featureLayout.get(rowNum)) {
                        featureLayout.set(rowNum, [])
                      }
                      const layoutRow = featureLayout.get(rowNum)
                      layoutRow?.push({ rowNum, feature: child, cds })
                    }
                  }
                }
              }
            } else {
              continue
            }
          }
          return featureLayout
        })
      },
      getFeatureLayoutPosition(feature: AnnotationFeature) {
        const { featureLayouts } = this
        for (const [idx, layout] of featureLayouts.entries()) {
          for (const [, layoutRow] of layout) {
            for (const { feature: layoutFeature } of layoutRow) {
              if (feature._id === layoutFeature._id) {
                return {
                  layoutIndex: idx,
                  layoutRow: 0,
                  featureRow: 0,
                }
              }
            }
          }
        }
        return
      },
    }))
    .views((_self) => ({
      get highestRow() {
        return 5
      },
    }))
    .actions((self) => ({
      afterAttach() {
        addDisposer(
          self,
          autorun(
            () => {
              if (!self.lgv.initialized || self.regionCannotBeRendered()) {
                return
              }
              for (const region of self.regions) {
                const assembly = (
                  self.session as unknown as ApolloSessionModel
                ).apolloDataStore.assemblies.get(region.assemblyName)
                const ref = assembly?.getByRefName(region.refName)
                const features = ref?.features
                if (!features) {
                  continue
                }
                for (const [, feature] of features) {
                  if (
                    doesIntersect2(
                      region.start,
                      region.end,
                      feature.min,
                      feature.max,
                    ) &&
                    !self.seenFeatures.has(feature._id)
                  ) {
                    self.addSeenFeature(feature)
                  }
                }
              }
            },
            { name: 'LinearApolloSixFrameDisplaySetSeenFeatures', delay: 1000 },
          ),
        )
      },
    }))
}
