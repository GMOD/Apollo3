import { ConfigurationReference, getConf } from '@jbrowse/core/configuration'
import { AnyConfigurationSchemaType } from '@jbrowse/core/configuration/configurationSchema'
import PluginManager from '@jbrowse/core/PluginManager'
import { MenuItem } from '@jbrowse/core/ui'
import {
  AppRootModel,
  doesIntersect2,
  getContainingView,
  getSession,
} from '@jbrowse/core/util'
import { getParentRenderProps } from '@jbrowse/core/util/tracks'
import type LinearGenomeViewPlugin from '@jbrowse/plugin-linear-genome-view'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'
import {
  AnnotationFeatureI,
  CanvasGlyphSnapshotIn,
  SceneGraphRootNode,
  SceneGraphRootNodeSnapshotIn,
} from 'apollo-mst'
import { autorun, observable } from 'mobx'
import {
  Instance,
  addDisposer,
  applySnapshot,
  getRoot,
  types,
} from 'mobx-state-tree'

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
      sceneGraphs: types.array(SceneGraphRootNode),
    })
    .actions((self) => ({
      updateSceneGraphs(sceneGraphsSnapshot: SceneGraphRootNodeSnapshotIn[]) {
        applySnapshot(self.sceneGraphs, sceneGraphsSnapshot)
      },
    }))
    .volatile(() => ({
      apolloFeatureUnderMouse: undefined as AnnotationFeatureI | undefined,
      apolloRowUnderMouse: undefined as number | undefined,
      seenFeatures: observable.map<string, AnnotationFeatureI>(),
    }))
    .actions((self) => ({
      addSeenFeature(feature: AnnotationFeatureI) {
        self.seenFeatures.set(feature._id, feature)
      },
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
      get displayedRegions() {
        const view = getContainingView(self) as unknown as LinearGenomeViewModel
        return view.displayedRegions
      },
    }))
    .views((self) => ({
      get rendererTypeName() {
        return self.configuration.renderer.type
      },
      get changeManager() {
        return self.session.apolloDataStore?.changeManager
      },
      get featuresMinMax() {
        const { assemblyManager } = self.session
        return self.displayedRegions.map((region) => {
          const assembly = assemblyManager.get(region.assemblyName)
          let min: number | undefined = undefined
          let max: number | undefined = undefined
          const { refName, start, end } = region
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
          return undefined
        })
      },
      get featureLayouts() {
        const { assemblyManager } = self.session
        return self.displayedRegions.map((region, idx) => {
          const assembly = assemblyManager.get(region.assemblyName)
          const featureLayout: Map<number, [number, AnnotationFeatureI][]> =
            new Map()
          const minMax = this.featuresMinMax[idx]
          if (!minMax) {
            return featureLayout
          }
          const [min, max] = minMax
          const rows: boolean[][] = []
          const { refName, start, end } = region
          self.seenFeatures.forEach((feature) => {
            if (
              refName !== assembly?.getCanonicalRefName(feature.refSeq) ||
              !doesIntersect2(start, end, feature.min, feature.max)
            ) {
              return
            }
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
                rowsForFeature = rows.slice(startingRow, startingRow + rowCount)
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
          return featureLayout
        })
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
        return Math.max(
          0,
          ...self.featureLayouts.map((layout) => Math.max(...layout.keys())),
        )
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
    .actions((self) => ({
      afterAttach() {
        addDisposer(
          self,
          autorun(
            () => {
              const view = getContainingView(
                self,
              ) as unknown as LinearGenomeViewModel
              if (!view.initialized || self.regionCannotBeRendered()) {
                return
              }
              self.session.apolloDataStore.loadFeatures(self.regions)
            },
            { name: 'LinearApolloDisplayLoadFeatures', delay: 1000 },
          ),
        )
        addDisposer(
          self,
          autorun(
            () => {
              const view = getContainingView(
                self,
              ) as unknown as LinearGenomeViewModel
              if (!view.initialized || self.regionCannotBeRendered()) {
                return
              }
              for (const region of self.regions) {
                const assembly = self.session.apolloDataStore.assemblies.get(
                  region.assemblyName,
                )
                const ref = assembly?.getByRefName(region.refName)
                ref?.features.forEach((feature) => {
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
        addDisposer(
          self,
          autorun(
            () => {
              const view = getContainingView(
                self,
              ) as unknown as LinearGenomeViewModel
              if (!view.initialized || self.regionCannotBeRendered()) {
                return
              }
              const sceneGraphsSnapshot = self.featureLayouts.map(
                (featureLayout) => {
                  const glyphSnapshots: CanvasGlyphSnapshotIn[] = []
                  featureLayout.forEach((featureLayoutRow, row) => {
                    featureLayoutRow.forEach(([featureRow, feature]) => {
                      if (featureRow > 0) {
                        return
                      }
                      glyphSnapshots.push({
                        relX: feature.min,
                        relY: row,
                        feature: feature._id,
                      })
                    })
                  })
                  return { relX: 0, relY: 0, children: glyphSnapshots }
                },
              )
              self.updateSceneGraphs(sceneGraphsSnapshot)
            },
            { name: 'LinearApolloDisplayUpdateSceneGraph', delay: 1000 },
          ),
        )
      },
    }))
}

export type LinearApolloDisplayStateModel = ReturnType<typeof stateModelFactory>
export type LinearApolloDisplay = Instance<LinearApolloDisplayStateModel>
