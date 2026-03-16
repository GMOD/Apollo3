/* eslint-disable @typescript-eslint/no-unnecessary-condition */

import type { AnnotationFeature } from '@apollo-annotation/mst'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { AnyConfigurationSchemaType } from '@jbrowse/core/configuration'
import { type AbstractSessionModel, doesIntersect2 } from '@jbrowse/core/util'
import { addDisposer, isAlive } from '@jbrowse/mobx-state-tree'
import { autorun, observable } from 'mobx'

import type { ApolloSessionModel } from '../../session'
import { isTranscriptFeature, looksLikeGene } from '../../util/glyphUtils'
import {
  boxGlyph,
  geneGlyph,
  genericChildGlyph,
  transcriptGlyph,
} from '../glyphs'

import { baseModelFactory } from './base'

function getRowsForFeature(
  startingRow: number,
  rowCount: number,
  filledRowLocations: Map<number, [number, number][]>,
) {
  const rowsForFeature = []
  for (let i = startingRow; i < startingRow + rowCount; i++) {
    const row = filledRowLocations.get(i)
    if (row) {
      rowsForFeature.push(row)
    }
  }
  return rowsForFeature
}

function canPlaceFeatureInRows(
  rowsForFeature: [number, number][][],
  feature: AnnotationFeature,
) {
  for (const rowForFeature of rowsForFeature) {
    for (const [rowStart, rowEnd] of rowForFeature) {
      if (
        doesIntersect2(feature.min, feature.max, rowStart, rowEnd) ||
        doesIntersect2(rowStart, rowEnd, feature.min, feature.max)
      ) {
        return false
      }
    }
  }

  return true
}

export function layoutsModelFactory(
  pluginManager: PluginManager,
  configSchema: AnyConfigurationSchemaType,
) {
  const BaseLinearApolloDisplay = baseModelFactory(pluginManager, configSchema)

  return BaseLinearApolloDisplay.named('LinearApolloDisplayLayouts')
    .props({
      cleanupBoundary: 200_000,
    })
    .volatile(() => ({
      seenFeatures: observable.map<string, AnnotationFeature>(),
    }))
    .views((self) => ({
      getAnnotationFeatureById(id: string) {
        return self.seenFeatures.get(id)
      },
      getGlyph(feature: AnnotationFeature) {
        const { topLevelFeature } = feature
        if (looksLikeGene(topLevelFeature, self.session)) {
          return geneGlyph
        }
        if (isTranscriptFeature(topLevelFeature, self.session)) {
          return transcriptGlyph
        }
        if (topLevelFeature.children?.size) {
          return genericChildGlyph
        }
        return boxGlyph
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
        return self.lgv.displayedRegions.map((region) => {
          const assembly = assemblyManager.get(region.assemblyName)
          const featureLayout = new Map<number, [number, string][]>()
          // Track the occupied coordinates in each row
          const filledRowLocations = new Map<number, [number, number][]>()
          const { end, refName, start } = region
          for (const [id, feature] of self.seenFeatures.entries()) {
            if (!isAlive(feature)) {
              self.deleteSeenFeature(id)
              continue
            }
            if (
              refName !== assembly?.getCanonicalRefName(feature.refSeq) ||
              !doesIntersect2(start, end, feature.min, feature.max) ||
              (self.filteredFeatureTypes.length > 0 &&
                !self.filteredFeatureTypes.includes(feature.type))
            ) {
              continue
            }
            const { featureTypeOntology } =
              self.session.apolloDataStore.ontologyManager
            if (!featureTypeOntology) {
              throw new Error('featureTypeOntology is undefined')
            }
            const rowCount = self
              .getGlyph(feature)
              // @ts-expect-error ts doesn't understand mst extension
              .getRowCount(self, feature)
            let startingRow = 0
            let placed = false
            while (!placed) {
              let rowsForFeature = getRowsForFeature(
                startingRow,
                rowCount,
                filledRowLocations,
              )
              if (rowsForFeature.length < rowCount) {
                for (let i = 0; i < rowCount - rowsForFeature.length; i++) {
                  const newRowNumber = filledRowLocations.size
                  filledRowLocations.set(newRowNumber, [])
                  featureLayout.set(newRowNumber, [])
                }
                rowsForFeature = getRowsForFeature(
                  startingRow,
                  rowCount,
                  filledRowLocations,
                )
              }
              if (!canPlaceFeatureInRows(rowsForFeature, feature)) {
                startingRow += 1
                continue
              }
              for (
                let rowNum = startingRow;
                rowNum < startingRow + rowCount;
                rowNum++
              ) {
                filledRowLocations.get(rowNum)?.push([feature.min, feature.max])
                const layoutRow = featureLayout.get(rowNum)
                layoutRow?.push([rowNum - startingRow, feature._id])
              }
              placed = true
            }
          }
          return featureLayout
        })
      },
      getFeatureLayoutPosition(feature: AnnotationFeature) {
        const { featureLayouts } = this
        const { featureTypeOntology } =
          self.session.apolloDataStore.ontologyManager
        for (const [idx, layout] of featureLayouts.entries()) {
          for (const [layoutRowNum, layoutRow] of layout) {
            for (const [featureRowNum, layoutFeatureId] of layoutRow) {
              if (featureRowNum !== 0) {
                // Same top-level feature in all feature rows, so only need to
                // check the first one
                continue
              }
              const layoutFeature =
                self.getAnnotationFeatureById(layoutFeatureId)
              if (!layoutFeature) {
                continue
              }
              if (feature._id === layoutFeature._id) {
                return {
                  layoutIndex: idx,
                  layoutRow: layoutRowNum,
                  featureRow: featureRowNum,
                }
              }
              if (layoutFeature.hasDescendant(feature._id)) {
                if (!featureTypeOntology) {
                  throw new Error('featureTypeOntology is undefined')
                }
                const row = self
                  .getGlyph(layoutFeature)
                  .getRowForFeature(layoutFeature, feature, featureTypeOntology)
                if (row !== undefined) {
                  return {
                    layoutIndex: idx,
                    layoutRow: layoutRowNum,
                    featureRow: row,
                  }
                }
              }
            }
          }
        }
        return
      },
    }))
    .views((self) => ({
      get highestRow() {
        return Math.max(
          0,
          ...self.featureLayouts.map((layout) => Math.max(...layout.keys())),
        )
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
              // Clear out features that are no longer in the view and out of the cleanup boundary
              // cleanup boundary + region boundary + cleanup boundary
              for (const [id, feature] of self.seenFeatures.entries()) {
                let shouldKeep = false
                for (const region of self.regions) {
                  const extendedStart = region.start - self.cleanupBoundary
                  const extendedEnd = region.end + self.cleanupBoundary
                  if (
                    doesIntersect2(
                      extendedStart,
                      extendedEnd,
                      feature.min,
                      feature.max,
                    )
                  ) {
                    shouldKeep = true
                    break
                  }
                }
                if (!shouldKeep) {
                  self.deleteSeenFeature(id)
                }
              }
              // Add features that are in the current view
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
            { name: 'LinearApolloDisplaySetSeenFeatures', delay: 1000 },
          ),
        )
      },
    }))
}
