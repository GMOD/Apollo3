import { AnyConfigurationSchemaType } from '@jbrowse/core/configuration/configurationSchema'
import PluginManager from '@jbrowse/core/PluginManager'
import { doesIntersect2 } from '@jbrowse/core/util'
import { AnnotationFeatureI } from 'apollo-mst'
import { autorun, observable } from 'mobx'
import { addDisposer, isAlive } from 'mobx-state-tree'

import { baseModelFactory } from './base'
import { getGlyph } from './getGlyph'

export function layoutsModelFactory(
  pluginManager: PluginManager,
  configSchema: AnyConfigurationSchemaType,
) {
  const BaseLinearApolloDisplay = baseModelFactory(pluginManager, configSchema)

  return BaseLinearApolloDisplay.named('LinearApolloDisplayLayouts')
    .volatile(() => ({
      seenFeatures: observable.map<string, AnnotationFeatureI>(),
    }))
    .views((self) => ({
      get featuresMinMax() {
        const { assemblyManager } = self.session
        return self.displayedRegions.map((region) => {
          const assembly = assemblyManager.get(region.assemblyName)
          let min: number | undefined
          let max: number | undefined
          const { end, refName, start } = region
          for (const [, feature] of self.seenFeatures) {
            if (
              refName !== assembly?.getCanonicalRefName(feature.refSeq) ||
              !doesIntersect2(start, end, feature.min, feature.max)
            ) {
              continue
            }
            if (min === undefined) {
              ;({ min } = feature)
            }
            if (max === undefined) {
              ;({ max } = feature)
            }
            if (feature.min < min) {
              ;({ min } = feature)
            }
            if (feature.end > max) {
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
      addSeenFeature(feature: AnnotationFeatureI) {
        self.seenFeatures.set(feature._id, feature)
      },
      deleteSeenFeature(featureId: string) {
        self.seenFeatures.delete(featureId)
      },
    }))
    .views((self) => ({
      get featureLayouts() {
        const { assemblyManager } = self.session
        return self.displayedRegions.map((region, idx) => {
          const assembly = assemblyManager.get(region.assemblyName)
          const featureLayout = new Map<
            number,
            [number, AnnotationFeatureI][]
          >()
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
            const rowCount = getGlyph(feature, self.lgv.bpPerPx).getRowCount(
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
                  rows[newRowNumber] = new Array(max - min)
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
                    return rowForFeature
                      .slice(feature.min - min, featureMax - min)
                      .some(Boolean)
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
                row.fill(true, feature.min - min, feature.max - min)
                const layoutRow = featureLayout.get(rowNum)
                layoutRow?.push([rowNum - startingRow, feature])
              }
              placed = true
            }
          }
          return featureLayout
        })
      },
      getFeatureLayoutPosition(feature: AnnotationFeatureI) {
        const { featureLayouts } = this
        for (const layout of featureLayouts) {
          for (const [layoutRowNum, layoutRow] of layout) {
            for (const [featureRowNum, layoutFeature] of layoutRow) {
              if (feature._id === layoutFeature._id) {
                return { layoutRow: layoutRowNum, featureRow: featureRowNum }
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
                const assembly = self.session.apolloDataStore.assemblies.get(
                  region.assemblyName,
                )
                const ref = assembly?.getByRefName(region.refName)
                ref?.features.forEach((feature: AnnotationFeatureI) => {
                  if (
                    doesIntersect2(
                      region.start,
                      region.end,
                      feature.start,
                      feature.end,
                    ) &&
                    !self.seenFeatures.has(feature._id)
                  ) {
                    self.addSeenFeature(feature)
                  }
                })
              }
            },
            { name: 'LinearApolloDisplaySetSeenFeatures', delay: 1000 },
          ),
        )
      },
    }))
}
