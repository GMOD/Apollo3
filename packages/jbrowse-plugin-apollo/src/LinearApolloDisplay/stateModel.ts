import { ConfigurationReference } from '@jbrowse/core/configuration'
import { AnyConfigurationSchemaType } from '@jbrowse/core/configuration/configurationSchema'
import PluginManager from '@jbrowse/core/PluginManager'
import { getSession } from '@jbrowse/core/util'
import { getParentRenderProps } from '@jbrowse/core/util/tracks'
import { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'
import { AnnotationFeatureI } from 'apollo-mst'
import { autorun } from 'mobx'
import { Instance, addDisposer, types } from 'mobx-state-tree'

import { ApolloSession } from '../session'

export function stateModelFactory(
  pluginManager: PluginManager,
  configSchema: AnyConfigurationSchemaType,
) {
  const LGVPlugin = pluginManager.getPlugin(
    'LinearGenomeViewPlugin',
  ) as import('@jbrowse/plugin-linear-genome-view').default
  const { BaseLinearDisplay } = LGVPlugin.exports

  return BaseLinearDisplay.named('LinearApolloDisplay')
    .props({
      type: types.literal('LinearApolloDisplay'),
      configuration: ConfigurationReference(configSchema),
      apolloRowHeight: 20,
    })
    .volatile(() => ({
      apolloFeatureUnderMouse: undefined as AnnotationFeatureI | undefined,
      apolloRowUnderMouse: undefined as number | undefined,
    }))
    .views((self) => {
      const { renderProps: superRenderProps } = self
      return {
        renderProps() {
          return {
            ...superRenderProps(),
            ...getParentRenderProps(self),
            config: self.configuration.renderer,
          }
        },
      }
    })
    .views((self) => ({
      get regions() {
        let blockDefinitions
        try {
          ;({ blockDefinitions } = self)
        } catch (error) {
          return []
        }
        const regions = blockDefinitions
          .map(({ assemblyName, refName, start, end }) => ({
            assemblyName,
            refName,
            start,
            end,
          }))
          .filter((block) => block.assemblyName)
        return regions
      },
    }))
    .actions((self) => ({
      afterAttach() {
        addDisposer(
          self,
          autorun(() => {
            const session = getSession(self) as ApolloSession
            session.apolloDataStore.loadFeatures(self.regions)
          }),
        )
      },
      setApolloFeatureUnderMouse(feature?: AnnotationFeatureI) {
        self.apolloFeatureUnderMouse = feature
      },
      setApolloRowUnderMouse(row?: number) {
        self.apolloRowUnderMouse = row
      },
    }))
    .views((self) => ({
      get rendererTypeName() {
        return self.configuration.renderer.type
      },
      get changeManager() {
        const session = getSession(self) as ApolloSession
        return session.apolloDataStore?.changeManager
      },
      get features() {
        const { regions } = self
        const session = getSession(self) as ApolloSession
        const features = new Map<
          string,
          Map<string, AnnotationFeatureLocationI>
        >()
        for (const region of regions) {
          const assembly = session.apolloDataStore.assemblies.get(
            region.assemblyName,
          )
          const ref = assembly.get(region.refName)
          let filteredRef = features.get(region.refName)
          if (!filteredRef) {
            filteredRef = new Map<string, AnnotationFeatureLocationI>()
            features.set(region.refName, filteredRef)
          }
          for (const [featureId, feature] of ref.entries()) {
            if (region.start < feature.end && region.end > feature.start) {
              filteredRef.set(featureId, feature)
            }
          }
        }
        return features
      },
      get featuresMinMax() {
        const minMax: Record<string, [number, number]> = {}
        for (const [refName, featuresForRefName] of this.features || []) {
          let min: number | undefined = undefined
          let max: number | undefined = undefined
          for (const [, featureLocation] of featuresForRefName) {
            if (min === undefined) {
              ;({ min } = featureLocation)
            }
            if (max === undefined) {
              ;({ max } = featureLocation)
            }
            if (featureLocation.min < min) {
              ;({ min } = featureLocation)
            }
            if (featureLocation.end > max) {
              ;({ max } = featureLocation)
            }
          }
          if (min !== undefined && max !== undefined) {
            minMax[refName] = [min, max]
          }
        }
        return minMax
      },
      get featureLayout() {
        const featureLayout: Map<number, [number, AnnotationFeatureI][]> =
          new Map()
        for (const [refName, featuresForRefName] of this.features || []) {
          if (!featuresForRefName) {
            continue
          }
          const [min, max] = this.featuresMinMax[refName] || [
            undefined,
            undefined,
          ]
          if (min === undefined || max === undefined) {
            continue
          }
          const rows: boolean[][] = []
          Array.from(featuresForRefName.values())
            .sort((f1, f2) => {
              const { min: start1, max: end1 } = f1
              const { min: start2, max: end2 } = f2
              return start1 - start2 || end1 - end2
            })
            .forEach((feature) => {
              const { rowCount } = feature
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
                  rowsForFeature = rows.slice(
                    startingRow,
                    startingRow + rowCount,
                  )
                }
                if (
                  rowsForFeature
                    .map((rowForFeature) =>
                      rowForFeature
                        .slice(feature.min - min, feature.max - min)
                        .some(Boolean),
                    )
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
            })
        }
        return featureLayout
      },
      getAssemblyId(assemblyName: string) {
        const { assemblyManager } = getSession(self)
        const assembly = assemblyManager.get(assemblyName)
        if (!assembly) {
          throw new Error(`Could not find assembly named ${assemblyName}`)
        }
        return assembly.name
      },
      get selectedFeature(): AnnotationFeatureI | undefined {
        return self.apolloView.selectedFeature
      },
      get setSelectedFeature() {
        const session = getSession(self) as ApolloSession
        return session.apolloSetSelectedFeature
      },
    }))
    .views((self) => ({
      get highestRow() {
        return Math.max(...self.featureLayout.keys())
      },
      get featuresHeight() {
        return this.highestRow * self.apolloRowHeight
      },
    }))
}

export type LinearApolloDisplayStateModel = ReturnType<typeof stateModelFactory>
export type LinearApolloDisplay = Instance<LinearApolloDisplayStateModel>
