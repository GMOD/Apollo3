/* eslint-disable @typescript-eslint/no-unnecessary-condition */

import { AnnotationFeature } from '@apollo-annotation/mst'
import { AnyConfigurationSchemaType } from '@jbrowse/core/configuration/configurationSchema'
import PluginManager from '@jbrowse/core/PluginManager'
import { AbstractSessionModel, doesIntersect2 } from '@jbrowse/core/util'
import { autorun, observable } from 'mobx'
import { addDisposer, isAlive } from 'mobx-state-tree'

import { ApolloSessionModel } from '../../session'
import { baseModelFactory } from './base'
import { getGlyph } from './getGlyph'

export function layoutsModelFactory(
  pluginManager: PluginManager,
  configSchema: AnyConfigurationSchemaType,
) {
  const BaseLinearApolloDisplay = baseModelFactory(pluginManager, configSchema)

  return BaseLinearApolloDisplay.named('LinearApolloDisplayLayouts')
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
          const featureLayout = new Map<number, [number, AnnotationFeature][]>()
          const minMax = self.featuresMinMax[idx]
          if (!minMax) {
            return featureLayout
          }
          const [min, max] = minMax
          const rows: boolean[][] = []
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
            const rowCount = getGlyph(feature).getRowCount(
              feature,
              self.lgv.bpPerPx,
            )
            let startingRow = 0
            let placed = false
            while (!placed) {
              let rowsForFeature = rows.slice(
                startingRow,
                startingRow + rowCount,
              )
              if (rowsForFeature.length < rowCount) {
                for (let i = 0; i < rowCount - rowsForFeature.length; i++) {
                  const newRowNumber = rows.length
                  rows[newRowNumber] = Array.from({ length: max - min })
                  featureLayout.set(newRowNumber, [])
                }
                rowsForFeature = rows.slice(startingRow, startingRow + rowCount)
              }
              if (
                rowsForFeature
                  .map((rowForFeature) => {
                    // zero-length features are allowed in the spec
                    const featureMax =
                      feature.max - feature.min === 0
                        ? feature.min + 1
                        : feature.max
                    let start = feature.min - min,
                      end = featureMax - min
                    if (feature.min - min < 0) {
                      start = 0
                      end = featureMax - feature.min
                    }
                    return rowForFeature.slice(start, end).some(Boolean)
                  })
                  .some(Boolean)
              ) {
                startingRow += 1
                continue
              }
              for (
                let rowNum = startingRow;
                rowNum < startingRow + rowCount;
                rowNum++
              ) {
                const row = rows[rowNum]
                let start = feature.min - min,
                  end = feature.max - min
                if (feature.min - min < 0) {
                  start = 0
                  end = feature.max - feature.min
                }
                row.fill(true, start, end)
                const layoutRow = featureLayout.get(rowNum)
                layoutRow?.push([rowNum - startingRow, feature])
              }
              placed = true
            }
          }
          return featureLayout
        })
      },
      getFeatureLayoutPosition(feature: AnnotationFeature) {
        const { featureLayouts } = this
        for (const [idx, layout] of featureLayouts.entries()) {
          for (const [layoutRowNum, layoutRow] of layout) {
            for (const [featureRowNum, layoutFeature] of layoutRow) {
              if (featureRowNum !== 0) {
                // Same top-level feature in all feature rows, so only need to
                // check the first one
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
                const row = getGlyph(layoutFeature).getRowForFeature(
                  layoutFeature,
                  feature,
                )
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
