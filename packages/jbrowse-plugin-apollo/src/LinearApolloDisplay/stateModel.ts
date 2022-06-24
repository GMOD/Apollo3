import { ConfigurationReference } from '@jbrowse/core/configuration'
import { AnyConfigurationSchemaType } from '@jbrowse/core/configuration/configurationSchema'
import PluginManager from '@jbrowse/core/PluginManager'
import { getContainingView, getSession } from '@jbrowse/core/util'
import { getParentRenderProps } from '@jbrowse/core/util/tracks'
import { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'
import { AnnotationFeatureLocationI } from 'apollo-shared'
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
        if (!dataStore) {
          return undefined
        }
        return dataStore.features
      },
      get featureLayout() {
        const featureLayout: Map<number, AnnotationFeatureLocationI[]> =
          new Map()
        for (const featuresForRefName of this.features?.values() || []) {
          let min: number
          let max: number
          const rows: boolean[][] = []
          Array.from(featuresForRefName.values())
            .sort((f1, f2) => {
              const { start: start1, end: end1 } = f1
              const { start: start2, end: end2 } = f2
              return start1 - start2 || end1 - end2
            })
            .forEach((feature) => {
              if (min === undefined) {
                min = feature.start
              }
              if (max === undefined) {
                max = feature.end
              }
              if (feature.start < min) {
                rows.forEach((row) => {
                  row.unshift(...new Array(min - feature.start))
                })
                min = feature.start
              }
              if (feature.end > max) {
                rows.forEach((row) => {
                  row.push(...new Array(feature.end - max))
                })
                max = feature.end
              }
              let rowNumber = 0
              let placed = false
              while (!placed) {
                let row = rows[rowNumber]
                if (!row) {
                  rows[rowNumber] = new Array(max - min)
                  row = rows[rowNumber]
                  row.fill(true, feature.start - min, feature.end - min)
                  featureLayout.set(rowNumber, [feature])
                  placed = true
                } else {
                  if (
                    row
                      .slice(feature.start - min, feature.end - min)
                      .some(Boolean)
                  ) {
                    rowNumber += 1
                  } else {
                    row.fill(true, feature.start - min, feature.end - min)
                    const layoutRow = featureLayout.get(rowNumber)
                    layoutRow?.push(feature)
                    placed = true
                  }
                }
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
