import { ConfigurationReference } from '@jbrowse/core/configuration'
import { AnyConfigurationSchemaType } from '@jbrowse/core/configuration/configurationSchema'
import PluginManager from '@jbrowse/core/PluginManager'
import { getContainingView } from '@jbrowse/core/util'
import { intersection2 } from '@jbrowse/core/util'
import { getParentRenderProps } from '@jbrowse/core/util/tracks'
import { Instance, types } from 'mobx-state-tree'

import { AnnotationFeatureI } from '../BackendDrivers/AnnotationFeature'

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
      get rendererTypeName() {
        return self.configuration.renderer.type
      },
      get featuresForBlock() {
        const featuresForBlock: Record<string, AnnotationFeatureI[]> = {}
        const lgv = getContainingView(self)
        const apolloView = getContainingView(lgv)
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        const { features } = apolloView
        self.blockDefinitions.forEach((block) => {
          if (block.start !== undefined && block.end !== undefined) {
            const assemblyFeatures = features
            const refNameFeatures = assemblyFeatures.get(block.refName)
            const relevantFeatures =
              refNameFeatures &&
              (
                Array.from(refNameFeatures.values()) as AnnotationFeatureI[]
              ).filter(
                (feature) =>
                  intersection2(
                    feature.location.start,
                    feature.location.end,
                    block.start,
                    block.end,
                  ).length,
              )
            if (relevantFeatures) {
              featuresForBlock[block.key] = relevantFeatures
            }
          }
        })
        return featuresForBlock
      },

      get featureLayout() {
        const lgv = getContainingView(self)
        const apolloView = getContainingView(lgv)
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        const { features } = apolloView
        const refNames: Map<string, Set<string>> = new Map()
        self.blockDefinitions.forEach((block) => {
          if (block.refName) {
            if (!refNames.has(block.assemblyName)) {
              refNames.set(block.assemblyName, new Set())
            }
            refNames.get(block.assemblyName)?.add(block.refName)
          }
        })
        const featureLayout: Record<string, number> = {}
        refNames.forEach((refNameList, assemblyName) => {
          const assemblyFeatures = features
          refNameList.forEach((refName) => {
            const refNameFeatures = assemblyFeatures?.get(refName)
            if (refNameFeatures) {
              let min: number
              let max: number
              const rows: boolean[][] = []
              ;(
                Array.from(refNameFeatures.values()) as AnnotationFeatureI[]
              ).forEach((feature) => {
                if (min === undefined) {
                  min = feature.location.start
                }
                if (max === undefined) {
                  max = feature.location.end
                }
                if (feature.location.start < min) {
                  rows.forEach((row) => {
                    row.unshift(...new Array(min - feature.location.start))
                  })
                  min = feature.location.start
                }
                if (feature.location.end > max) {
                  rows.forEach((row) => {
                    row.push(...new Array(feature.location.end - max))
                  })
                  max = feature.location.end
                }
                let rowNumber = 0
                let placed = false
                while (!placed) {
                  let row = rows[rowNumber]
                  if (!row) {
                    rows[rowNumber] = new Array(max - min)
                    row = rows[rowNumber]
                    row.fill(
                      true,
                      feature.location.start - min,
                      feature.location.end - min,
                    )
                    featureLayout[feature.id] = rowNumber
                    placed = true
                  } else {
                    if (
                      row
                        .slice(
                          feature.location.start - min,
                          feature.location.end - min,
                        )
                        .some(Boolean)
                    ) {
                      rowNumber += 1
                    } else {
                      row.fill(
                        true,
                        feature.location.start - min,
                        feature.location.end - min,
                      )
                      featureLayout[feature.id] = rowNumber
                      placed = true
                    }
                  }
                }
              })
            }
          })
        })
        return featureLayout
      },
    }))
}

export type LinearApolloDisplayStateModel = ReturnType<typeof stateModelFactory>
export type LinearApolloDisplay = Instance<LinearApolloDisplayStateModel>
