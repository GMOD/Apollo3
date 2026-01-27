/* eslint-disable @typescript-eslint/no-unnecessary-condition */

import { type AnnotationFeature } from '@apollo-annotation/mst'
import type PluginManager from '@jbrowse/core/PluginManager'
import { type AnyConfigurationSchemaType } from '@jbrowse/core/configuration'
import {
  type AbstractSessionModel,
  doesIntersect2,
  getFrame,
} from '@jbrowse/core/util'
import { addDisposer, isAlive } from '@jbrowse/mobx-state-tree'
import { autorun, entries, observable } from 'mobx'

import { type ApolloSessionModel } from '../../session'
import { geneGlyph } from '../glyphs'

import { baseModelFactory } from './base'

export interface LayoutRow {
  rowNum: number
  feature: AnnotationFeature
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
          for (const [, feature] of entries(self.seenFeatures)) {
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
      featureLabelSpacer(elem: number): number {
        return self.showFeatureLabels ? elem * 2 - 1 : elem
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
      get geneTrackRowNums() {
        return [4, 5].map((elem) => self.featureLabelSpacer(elem))
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
          for (const [id, feature] of entries(self.seenFeatures)) {
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
              const rowNum =
                feature.strand == 1
                  ? self.geneTrackRowNums[0]
                  : self.geneTrackRowNums[1]
              if (!featureLayout.get(rowNum)) {
                featureLayout.set(rowNum, [])
              }
              const layoutRow = featureLayout.get(rowNum)
              layoutRow?.push({ rowNum, feature })
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
                      const rowNum =
                        exon.strand == 1
                          ? self.geneTrackRowNums[0]
                          : self.geneTrackRowNums[1]
                      const layoutRow = featureLayout.get(rowNum)
                      layoutRow?.push({ rowNum, feature: exon })
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
                      rowNum = self.featureLabelSpacer(
                        rowNum < 0 ? -1 * rowNum + 5 : rowNum,
                      )
                      if (!featureLayout.get(rowNum)) {
                        featureLayout.set(rowNum, [])
                      }
                      const layoutRow = featureLayout.get(rowNum)
                      layoutRow?.push({ rowNum, feature: child })
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
