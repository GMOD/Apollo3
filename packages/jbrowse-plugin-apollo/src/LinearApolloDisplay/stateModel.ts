import { ConfigurationReference, getConf } from '@jbrowse/core/configuration'
import { AnyConfigurationSchemaType } from '@jbrowse/core/configuration/configurationSchema'
import PluginManager from '@jbrowse/core/PluginManager'
import { MenuItem } from '@jbrowse/core/ui'
import { AppRootModel, getContainingView, getSession } from '@jbrowse/core/util'
import { BaseBlock } from '@jbrowse/core/util/blockTypes'
import { getParentRenderProps } from '@jbrowse/core/util/tracks'
import type LinearGenomeViewPlugin from '@jbrowse/plugin-linear-genome-view'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'
import { AnnotationFeatureI } from 'apollo-mst'
import { autorun } from 'mobx'
import { Instance, addDisposer, getRoot, types } from 'mobx-state-tree'

import { ApolloInternetAccountModel } from '../ApolloInternetAccount/model'
import { getFeatureRowCount } from '../ApolloRenderer/components/featureDrawing'
import {
  AddFeature,
  DeleteFeature,
  ModifyFeatureAttribute,
} from '../components'
import { ApolloSession } from '../session'

export function stateModelFactory(
  pluginManager: PluginManager,
  configSchema: AnyConfigurationSchemaType,
) {
  const LGVPlugin = pluginManager.getPlugin(
    'LinearGenomeViewPlugin',
  ) as LinearGenomeViewPlugin
  const { BaseLinearDisplay } = LGVPlugin.exports

  return BaseLinearDisplay.named('LinearApolloDisplay')
    .props({
      type: types.literal('LinearApolloDisplay'),
      configuration: ConfigurationReference(configSchema),
      apolloRowHeight: 20,
      detailsMinHeight: 200,
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
      get session() {
        return getSession(self) as ApolloSession
      },
    }))
    .views((self) => ({
      get blockType(): 'staticBlocks' | 'dynamicBlocks' {
        return 'dynamicBlocks'
      },
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
    .actions((self) => {
      let previousBlockKeys: string[] = []
      return {
        afterAttach() {
          addDisposer(
            self,
            autorun(
              () => {
                const view = getContainingView(
                  self,
                ) as unknown as LinearGenomeViewModel
                if (view.initialized) {
                  if (self.regionCannotBeRendered()) {
                    return
                  }
                  const blockKeys: string[] = []
                  const newBlocks: BaseBlock[] = []
                  self.blockDefinitions.contentBlocks.forEach((block) => {
                    blockKeys.push(block.key)
                    if (!previousBlockKeys.includes(block.key)) {
                      newBlocks.push(block)
                    }
                  })
                  self.session.apolloDataStore.loadFeatures(
                    newBlocks.map(({ assemblyName, refName, start, end }) => ({
                      assemblyName,
                      refName,
                      start,
                      end,
                    })),
                  )
                  previousBlockKeys = blockKeys
                }
              },
              { name: 'LinearApolloDisplay' },
            ),
          )
        },
      }
    })
    .views((self) => ({
      get rendererTypeName() {
        return self.configuration.renderer.type
      },
      get changeManager() {
        return self.session.apolloDataStore?.changeManager
      },
      get features() {
        const { regions } = self
        const features = new Map<string, Map<string, AnnotationFeatureI>>()
        for (const region of regions) {
          const assembly = self.session.apolloDataStore.assemblies.get(
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
          Array.from(featuresForRefSeq.values())
            .sort((f1, f2) => {
              const { min: start1, max: end1 } = f1
              const { min: start2, max: end2 } = f2
              return start1 - start2 || end1 - end2
            })
            .forEach((feature) => {
              const rowCount = getFeatureRowCount(feature)
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
        const { assemblyManager } = self.session
        const assembly = assemblyManager.get(assemblyName)
        if (!assembly) {
          throw new Error(`Could not find assembly named ${assemblyName}`)
        }
        return assembly.name
      },
      get selectedFeature(): AnnotationFeatureI | undefined {
        return self.session.apolloSelectedFeature
      },
    }))
    .actions((self) => ({
      setSelectedFeature(feature?: AnnotationFeatureI) {
        return self.session.apolloSetSelectedFeature(feature)
      },
      setApolloFeatureUnderMouse(feature?: AnnotationFeatureI) {
        self.apolloFeatureUnderMouse = feature
      },
      setApolloRowUnderMouse(row?: number) {
        self.apolloRowUnderMouse = row
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
      get detailsHeight() {
        return Math.max(
          self.detailsMinHeight,
          self.height - this.featuresHeight,
        )
      },
    }))
    .views((self) => ({
      get apolloInternetAccount() {
        const [region] = self.regions
        const { internetAccounts } = getRoot(self) as AppRootModel
        const { assemblyName } = region
        const { assemblyManager } = self.session
        const assembly = assemblyManager.get(assemblyName)
        if (!assembly) {
          throw new Error(`No assembly found with name ${assemblyName}`)
        }
        const { internetAccountConfigId } = getConf(assembly, [
          'sequence',
          'metadata',
        ]) as { internetAccountConfigId: string }
        const matchingAccount = internetAccounts.find(
          (ia) => getConf(ia, 'internetAccountId') === internetAccountConfigId,
        ) as ApolloInternetAccountModel | undefined
        if (!matchingAccount) {
          throw new Error(
            `No InternetAccount found with config id ${internetAccountConfigId}`,
          )
        }
        return matchingAccount
      },
    }))
    .volatile(() => ({
      apolloContextMenuFeature: undefined as AnnotationFeatureI | undefined,
    }))
    .actions((self) => ({
      setApolloContextMenuFeature(feature?: AnnotationFeatureI) {
        self.apolloContextMenuFeature = feature
      },
    }))
    .views((self) => ({
      contextMenuItems(): MenuItem[] {
        const { getRole } = self.apolloInternetAccount
        const role = getRole()
        const admin = role === 'admin'
        const readOnly = !Boolean(role && ['admin', 'user'].includes(role))
        const menuItems: MenuItem[] = []
        const {
          apolloContextMenuFeature: sourceFeature,
          apolloInternetAccount: internetAccount,
          changeManager,
          getAssemblyId,
          session,
          regions,
        } = self
        if (sourceFeature) {
          const [region] = regions
          const sourceAssemblyId = getAssemblyId(region.assemblyName)
          const currentAssemblyId = getAssemblyId(region.assemblyName)
          menuItems.push(
            {
              label: 'Add child feature',
              disabled: readOnly,
              onClick: () => {
                session.queueDialog((doneCallback) => [
                  AddFeature,
                  {
                    session,
                    handleClose: () => {
                      doneCallback()
                      self.setApolloContextMenuFeature(undefined)
                    },
                    changeManager,
                    sourceFeature,
                    sourceAssemblyId,
                    internetAccount,
                  },
                ])
              },
            },
            // {
            //   label: 'Copy features and annotations',
            //   disabled: isReadOnly,
            //   onClick: () => {
            //     const currentAssemblyId = getAssemblyId(region.assemblyName)
            //     session.queueDialog((doneCallback) => [
            //       CopyFeature,
            //       {
            //         session,
            //         handleClose: () => {
            //           doneCallback()
            //           setContextMenuFeature(undefined)
            //         },
            //         changeManager,
            //         sourceFeatureId: contextMenuFeature?._id,
            //         sourceAssemblyId: currentAssemblyId,
            //       },
            //     ])
            //   },
            // },
            {
              label: 'Delete feature',
              disabled: !admin,
              onClick: () => {
                session.queueDialog((doneCallback) => [
                  DeleteFeature,
                  {
                    session,
                    handleClose: () => {
                      doneCallback()
                      self.setApolloContextMenuFeature(undefined)
                    },
                    changeManager,
                    sourceFeature,
                    sourceAssemblyId: currentAssemblyId,
                    selectedFeature: self.selectedFeature,
                    setSelectedFeature: self.setSelectedFeature,
                  },
                ])
              },
            },
            {
              label: 'Modify feature attribute',
              disabled: readOnly,
              onClick: () => {
                session.queueDialog((doneCallback) => [
                  ModifyFeatureAttribute,
                  {
                    session,
                    handleClose: () => {
                      doneCallback()
                      self.setApolloContextMenuFeature(undefined)
                    },
                    changeManager,
                    sourceFeature,
                    sourceAssemblyId: currentAssemblyId,
                  },
                ])
              },
            },
          )
        }
        return menuItems
      },
    }))
}

export type LinearApolloDisplayStateModel = ReturnType<typeof stateModelFactory>
export type LinearApolloDisplay = Instance<LinearApolloDisplayStateModel>
