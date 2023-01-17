import { ConfigurationReference } from '@jbrowse/core/configuration'
import { AnyConfigurationSchemaType } from '@jbrowse/core/configuration/configurationSchema'
import PluginManager from '@jbrowse/core/PluginManager'
import { getContainingView, getSession } from '@jbrowse/core/util'
import { getParentRenderProps } from '@jbrowse/core/util/tracks'
import type LinearGenomeViewPlugin from '@jbrowse/plugin-linear-genome-view'
import { AnnotationFeatureI } from 'apollo-mst'
import { Instance, types } from 'mobx-state-tree'

import { ApolloSession } from '../session'

export function stateModelFactory(
  pluginManager: PluginManager,
  configSchema: AnyConfigurationSchemaType,
) {
  const LGVPlugin = pluginManager.getPlugin(
    'LinearGenomeViewPlugin',
  ) as LinearGenomeViewPlugin
  const { BaseLinearDisplay } = LGVPlugin.exports

  return BaseLinearDisplay.named('SixFrameFeatureDisplay')
    .props({
      type: types.literal('SixFrameFeatureDisplay'),
      configuration: ConfigurationReference(configSchema),
      apolloRowHeight: 20,
      detailsMinHeight: 200,
      showStartCodons: true,
      showStopCodons: true,
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
        const regions = blockDefinitions.contentBlocks.map(
          ({ assemblyName, refName, start, end }) => ({
            assemblyName,
            refName,
            start,
            end,
          }),
        )
        return regions
      },
      regionCannotBeRendered(/* region */) {
        const view = getContainingView(self)
        if (view && view.bpPerPx >= 200) {
          return 'Zoom in to see annotations'
        }
        return undefined
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
        const features = new Map<string, Map<string, AnnotationFeatureI>>()
        for (const region of regions) {
          const assembly = session.apolloDataStore.assemblies.get(
            region.assemblyName,
          )
          const ref = assembly?.getByRefName(region.refName)
          let filteredRef = features.get(region.refName)
          if (!filteredRef) {
            filteredRef = new Map<string, AnnotationFeatureI>()
            features.set(region.refName, filteredRef)
          }
          for (const [featureId, feature] of ref?.features.entries() ||
            new Map()) {
            if (region.start < feature.end && region.end > feature.start) {
              filteredRef.set(featureId, feature)
            }
          }
        }
        return features
      },
      get featuresMinMax() {
        const minMax: Record<string, [number, number]> = {}
        for (const [refSeq, featuresForRefSeq] of this.features || []) {
          let min: number | undefined = undefined
          let max: number | undefined = undefined
          for (const [, featureLocation] of featuresForRefSeq) {
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
            minMax[refSeq] = [min, max]
          }
        }
        return minMax
      },
      get featureLayout() {
        const forwardPhaseMap: Record<number, number> = {
          0: 2,
          1: 1,
          2: 0,
        }
        const featureLayout: Map<number, [number, AnnotationFeatureI][]> =
          new Map()
        for (const [refSeq, featuresForRefSeq] of this.features || []) {
          if (!featuresForRefSeq) {
            continue
          }
          const minMaxfeatures = this.featuresMinMax[refSeq]
          if (!minMaxfeatures) {
            continue
          }
          const [min, max] = minMaxfeatures
          const rows: boolean[][] = []
          const rowCount = 6
          for (let i = 0; i < rowCount; i++) {
            const newRowNumber = rows.length
            rows[newRowNumber] = new Array(max - min)
            featureLayout.set(newRowNumber, [])
          }
          Array.from(featuresForRefSeq.values())
            .sort((f1, f2) => {
              const { min: start1, max: end1 } = f1
              const { min: start2, max: end2 } = f2
              return start1 - start2 || end1 - end2
            })
            .forEach((feature) => {
              for (const [, childFeature] of feature.children || new Map()) {
                if (childFeature.type === 'mRNA') {
                  for (const [, grandChildFeature] of childFeature.children ||
                    new Map()) {
                    let startingRow = 0
                    if (grandChildFeature.phase !== undefined) {
                      startingRow = grandChildFeature.phase
                      if (feature.strand === -1) {
                        startingRow += 3
                      } else {
                        startingRow = forwardPhaseMap[grandChildFeature.phase]
                      }
                      const row = rows[startingRow]
                      row.fill(
                        true,
                        grandChildFeature.min - min,
                        grandChildFeature.max - min,
                      )
                      const layoutRow = featureLayout.get(startingRow)
                      layoutRow?.push([0, grandChildFeature])
                    }
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
      get selectedFeature(): AnnotationFeatureI | undefined {
        const session = getSession(self) as ApolloSession
        return session.apolloSelectedFeature
      },
      get setSelectedFeature() {
        const session = getSession(self) as ApolloSession
        return session.apolloSetSelectedFeature
      },
    }))
    .actions((self) => ({
      setSelectedFeature(feature?: AnnotationFeatureI) {
        const session = getSession(self) as ApolloSession
        return session.apolloSetSelectedFeature(feature)
      },
      setApolloFeatureUnderMouse(feature?: AnnotationFeatureI) {
        self.apolloFeatureUnderMouse = feature
      },
      setApolloRowUnderMouse(row?: number) {
        self.apolloRowUnderMouse = row
      },
      toggleShowStartCodons() {
        self.showStartCodons = !self.showStartCodons
      },
      toggleShowStopCodons() {
        self.showStopCodons = !self.showStopCodons
      },
    }))
    .views((self) => ({
      get highestRow() {
        if (!self.featureLayout.size) {
          return 0
        }
        return Math.max(...self.featureLayout.keys())
      },
      get featuresHeight() {
        return this.highestRow * self.apolloRowHeight
      },
      trackMenuItems() {
        return [
          {
            label: 'Show start codons',
            type: 'checkbox',
            checked: self.showStartCodons,
            onClick: () => self.toggleShowStartCodons(),
          },
          {
            label: 'Show stop codons',
            type: 'checkbox',
            checked: self.showStopCodons,
            onClick: () => self.toggleShowStopCodons(),
          },
        ]
      },
    }))
}

export type SixFrameFeatureDisplayStateModel = ReturnType<
  typeof stateModelFactory
>
export type SixFrameFeatureDisplay = Instance<SixFrameFeatureDisplayStateModel>
