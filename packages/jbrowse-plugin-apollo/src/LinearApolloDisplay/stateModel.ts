import { ConfigurationReference } from '@jbrowse/core/configuration'
import { AnyConfigurationSchemaType } from '@jbrowse/core/configuration/configurationSchema'
import PluginManager from '@jbrowse/core/PluginManager'
import { getContainingView, getSession } from '@jbrowse/core/util'
import { getParentRenderProps } from '@jbrowse/core/util/tracks'
import { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'
import { AnnotationFeatureLocationI } from 'apollo-mst'
import { autorun } from 'mobx'
import { Instance, addDisposer, types } from 'mobx-state-tree'

import { ApolloViewModel } from '../ApolloView/stateModel'

export function stateModelFactory(
  pluginManager: PluginManager,
  configSchema: AnyConfigurationSchemaType,
) {
  const LGVPlugin = pluginManager.getPlugin(
    'LinearGenomeViewPlugin',
  ) as import('@jbrowse/plugin-linear-genome-view').default
  const { BaseLinearDisplay } = LGVPlugin.exports

  return types
    .compose(
      'LinearApolloDisplay',
      BaseLinearDisplay,
      types.model({
        type: types.literal('LinearApolloDisplay'),
        configuration: ConfigurationReference(configSchema),
      }),
    )
    .volatile(() => ({
      apolloFeatureUnderMouse: undefined as
        | AnnotationFeatureLocationI
        | undefined,
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
      get apolloView() {
        const lgv = getContainingView(self)
        return getContainingView(lgv) as unknown as ApolloViewModel
      },
    }))
    .actions((self) => ({
      afterAttach() {
        addDisposer(
          self,
          autorun(() => {
            const lgv = getContainingView(self) as LinearGenomeViewModel
            const { initialized } = lgv
            if (!initialized) {
              return
            }
            const { dataStore } = self.apolloView
            if (!dataStore) {
              return
            }
            const { backendDriver } = dataStore
            if (!backendDriver) {
              return
            }
            const regions = self.blockDefinitions
              .map(({ assemblyName, refName, start, end }) => ({
                assemblyName,
                refName,
                start,
                end,
              }))
              .filter((block) => block.assemblyName)
            dataStore.backendDriver.loadFeatures(regions)
          }),
        )
      },
      setApolloFeatureUnderMouse(feature?: AnnotationFeatureLocationI) {
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
        return self.apolloView.dataStore?.changeManager
      },
      get features() {
        const { dataStore } = self.apolloView
        return dataStore?.features
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
        const featureLayout: Map<
          number,
          [number, AnnotationFeatureLocationI][]
        > = new Map()
        for (const [refName, featuresForRefName] of this.features || []) {
          if (!featuresForRefName) {
            continue
          }
          const [min, max] = this.featuresMinMax[refName]
          const rows: boolean[][] = []
          Array.from(featuresForRefName.values())
            .sort((f1, f2) => {
              const { min: start1, max: end1 } = f1
              const { min: start2, max: end2 } = f2
              return start1 - start2 || end1 - end2
            })
            .forEach((featureLocation) => {
              const { rowCount } = featureLocation
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
                        .slice(
                          featureLocation.min - min,
                          featureLocation.max - min,
                        )
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
                  row.fill(
                    true,
                    featureLocation.min - min,
                    featureLocation.max - min,
                  )
                  const layoutRow = featureLayout.get(rowNum)
                  layoutRow?.push([rowNum - startingRow, featureLocation])
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
      get selectedFeature(): AnnotationFeatureLocationI | undefined {
        return self.apolloView.selectedFeature
      },
      get setSelectedFeature() {
        return self.apolloView.setSelectedFeature
      },
    }))
}

export type LinearApolloDisplayStateModel = ReturnType<typeof stateModelFactory>
export type LinearApolloDisplay = Instance<LinearApolloDisplayStateModel>
