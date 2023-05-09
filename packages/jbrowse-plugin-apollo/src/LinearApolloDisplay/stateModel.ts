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
import { AnnotationFeatureI } from 'apollo-mst'
import { LocationEndChange, LocationStartChange } from 'apollo-shared'
import { autorun, observable } from 'mobx'
import { Instance, addDisposer, getRoot, types } from 'mobx-state-tree'

import { ApolloInternetAccountModel } from '../ApolloInternetAccount/model'
import {
  draw,
  getFeatureFromLayout,
  getFeatureRowCount,
} from '../ApolloRenderer/components/featureDrawing'
import {
  AddFeature,
  DeleteFeature,
  ModifyFeatureAttribute,
} from '../components'
import { Collaborator } from '../session'

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
    .volatile((self) => ({
      seenFeatures: observable.map<string, AnnotationFeatureI>(),
      lgv: getContainingView(self) as unknown as LinearGenomeViewModel,
      canvas: null as HTMLCanvasElement | null,
    }))
    .actions((self) => ({
      addSeenFeature(feature: AnnotationFeatureI) {
        self.seenFeatures.set(feature._id, feature)
      },
      setCanvas(canvas: HTMLCanvasElement | null) {
        self.canvas = canvas
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
        return getSession(self)
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
        if (self.lgv && self.lgv.bpPerPx >= 200) {
          return 'Zoom in to see annotations'
        }
        return undefined
      },
      get displayedRegions() {
        return self.lgv.displayedRegions
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
    .volatile(() => ({
      overlayCanvas: null as HTMLCanvasElement | null,
      apolloFeatureUnderMouse: undefined as AnnotationFeatureI | undefined,
      movedDuringLastMouseDown: false,
      overEdge: null as 'start' | 'end' | null,
      dragging: null as {
        edge: 'start' | 'end'
        feature: AnnotationFeatureI
        x: number
        y: number
        regionIndex: number
      } | null,
    }))
    .actions((self) => ({
      setOverlayCanvas(canvas: HTMLCanvasElement | null) {
        self.overlayCanvas = canvas
      },
      setMovedDuringLastMouseDown(moved: boolean) {
        self.movedDuringLastMouseDown = moved
      },
      setApolloFeatureUnderMouse(feature?: AnnotationFeatureI) {
        self.apolloFeatureUnderMouse = feature
      },
      setOverEdge(edge?: 'start' | 'end') {
        self.overEdge = edge || null
      },
      setDragging(dragInfo?: {
        edge: 'start' | 'end'
        feature: AnnotationFeatureI
        x: number
        y: number
        regionIndex: number
      }) {
        self.dragging = dragInfo || null
      },
      onMouseMove(event: React.MouseEvent<HTMLCanvasElement, MouseEvent>) {
        if (!self.overlayCanvas) {
          return
        }
        const { clientX, clientY, buttons } = event
        if (!self.movedDuringLastMouseDown && buttons === 1) {
          this.setMovedDuringLastMouseDown(true)
        }
        const { left, top } = self.overlayCanvas.getBoundingClientRect() || {
          left: 0,
          top: 0,
        }
        const x = clientX - left
        const bpInfo = self.lgv.pxToBp(x)
        const { refName, coord, index: regionNumber } = bpInfo

        const y = clientY - top

        if (self.dragging) {
          const { edge, feature } = self.dragging
          this.setDragging({
            edge,
            feature,
            x,
            y: self.dragging.y,
            regionIndex: regionNumber,
          })
          return
        }

        const row = Math.floor(y / self.apolloRowHeight)
        if (row === undefined) {
          this.setApolloFeatureUnderMouse(undefined)
          return
        }
        const featureLayout = self.featureLayouts[bpInfo.index]
        const layoutRow = featureLayout.get(row)
        if (!layoutRow) {
          this.setApolloFeatureUnderMouse(undefined)
          return
        }
        const [featureRow, feat] =
          layoutRow.find((f) => coord >= f[1].min && coord <= f[1].max) || []
        let feature: AnnotationFeatureI | undefined = feat
        if (feature && featureRow) {
          const topRow = row - featureRow
          feature = getFeatureFromLayout(feature, coord, topRow)
        }
        if (feature) {
          // TODO: check reversed
          // TODO: ensure feature is in interbase
          const startPxInfo = self.lgv.bpToPx({
            refName,
            coord: feature.start,
            regionNumber,
          })
          const endPxInfo = self.lgv.bpToPx({
            refName,
            coord: feature.end,
            regionNumber,
          })
          if (startPxInfo !== undefined && endPxInfo !== undefined) {
            const startPx = startPxInfo.offsetPx - self.lgv.offsetPx
            const endPx = endPxInfo.offsetPx - self.lgv.offsetPx
            if (endPx - startPx < 8) {
              this.setOverEdge(undefined)
            } else if (Math.abs(startPx - x) < 4) {
              this.setOverEdge('start')
            } else if (Math.abs(endPx - x) < 4) {
              this.setOverEdge('end')
            } else {
              this.setOverEdge(undefined)
            }
          } else {
            this.setOverEdge(undefined)
          }
        }
        this.setApolloFeatureUnderMouse(feature)
      },
      onMouseLeave() {
        this.setApolloFeatureUnderMouse(undefined)
      },
      onMouseDown(event: React.MouseEvent) {
        if (!self.overlayCanvas) {
          return
        }
        if (!(self.apolloFeatureUnderMouse && self.overEdge)) {
          return
        }
        event.stopPropagation()
        const { left, top } = self.overlayCanvas.getBoundingClientRect() || {
          left: 0,
          top: 0,
        }
        const { clientX, clientY } = event

        const x = clientX - left
        const y = clientY - top
        const bpInfo = self.lgv.pxToBp(x)
        const { index } = bpInfo

        this.setDragging({
          edge: self.overEdge,
          feature: self.apolloFeatureUnderMouse,
          x,
          y,
          regionIndex: index,
        })
      },
      onMouseUp() {
        if (!self.movedDuringLastMouseDown) {
          if (self.apolloFeatureUnderMouse) {
            self.setSelectedFeature(self.apolloFeatureUnderMouse)
          }
        } else if (self.dragging) {
          const { feature, edge, regionIndex } = self.dragging
          const bp = feature[edge]
          const region = self.displayedRegions[regionIndex]
          const assembly = self.getAssemblyId(region.assemblyName)
          let change: LocationEndChange | LocationStartChange
          if (edge === 'end') {
            const featureId = feature._id
            const oldEnd = feature.end
            const newEnd = Math.round(bp)
            change = new LocationEndChange({
              typeName: 'LocationEndChange',
              changedIds: [featureId],
              featureId,
              oldEnd,
              newEnd,
              assembly,
            })
          } else {
            const featureId = feature._id
            const oldStart = feature.start
            const newStart = Math.round(bp)
            change = new LocationStartChange({
              typeName: 'LocationStartChange',
              changedIds: [featureId],
              featureId,
              oldStart,
              newStart,
              assembly,
            })
          }
          self.changeManager?.submit(change)
        }
        this.setDragging(undefined)
        this.setMovedDuringLastMouseDown(false)
      },
      onContextMenu(event: React.MouseEvent) {
        event.preventDefault()
        self.setApolloContextMenuFeature(self.apolloFeatureUnderMouse)
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
              self.session.apolloDataStore.loadFeatures(self.regions)
            },
            { name: 'LinearApolloDisplayLoadFeatures', delay: 1000 },
          ),
        )
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
        addDisposer(
          self,
          autorun(
            () => {
              if (!self.lgv.initialized || self.regionCannotBeRendered()) {
                return
              }
              const ctx = self.canvas?.getContext('2d')
              if (!ctx) {
                return
              }
              ctx.clearRect(
                0,
                0,
                self.lgv.dynamicBlocks.totalWidthPx,
                self.featuresHeight,
              )
              self.featureLayouts.forEach((featureLayout, idx) => {
                const displayedRegion = self.displayedRegions[idx]
                featureLayout.forEach((featureLayoutRow, row) => {
                  featureLayoutRow.forEach(([featureRow, feature]) => {
                    if (featureRow > 0) {
                      return
                    }
                    const x =
                      (self.lgv.bpToPx({
                        refName: displayedRegion.refName,
                        coord: feature.min,
                        regionNumber: idx,
                      })?.offsetPx || 0) - self.lgv.offsetPx
                    const widthPx =
                      (feature.max - feature.min) / self.lgv.bpPerPx
                    if (
                      !doesIntersect2(
                        0,
                        self.lgv.dynamicBlocks.totalWidthPx,
                        x,
                        x + widthPx,
                      )
                    ) {
                      return
                    }
                    draw(
                      feature,
                      ctx,
                      x,
                      row * self.apolloRowHeight,
                      self.lgv.bpPerPx,
                      self.apolloRowHeight,
                      displayedRegion.reversed,
                    )
                  })
                })
              })
            },
            { name: 'LinearApolloDisplayRenderFeatures' },
          ),
        )
        addDisposer(
          self,
          autorun(
            () => {
              if (!self.lgv.initialized || self.regionCannotBeRendered()) {
                return
              }
              const ctx = self.overlayCanvas?.getContext('2d')
              if (!ctx) {
                return
              }
              ctx.clearRect(
                0,
                0,
                self.lgv.dynamicBlocks.totalWidthPx,
                self.featuresHeight,
              )
              if (self.dragging) {
                const { feature, edge, x, y, regionIndex } = self.dragging
                const row = Math.floor(y / self.apolloRowHeight)
                const region = self.displayedRegions[regionIndex]
                const rowCount = getFeatureRowCount(feature)
                const featureEdge = region.reversed
                  ? region.end - feature[edge]
                  : feature[edge] - region.start
                const featureEdgePx =
                  featureEdge / self.lgv.bpPerPx - self.lgv.offsetPx
                const startPx = Math.min(x, featureEdgePx)
                const widthPx = Math.abs(x - featureEdgePx)
                ctx.strokeStyle = 'red'
                ctx.setLineDash([6])
                ctx.strokeRect(
                  startPx,
                  row * self.apolloRowHeight,
                  widthPx,
                  self.apolloRowHeight * rowCount,
                )
                ctx.fillStyle = 'rgba(255,0,0,.2)'
                ctx.fillRect(
                  startPx,
                  row * self.apolloRowHeight,
                  widthPx,
                  self.apolloRowHeight * rowCount,
                )
              }
              const { apolloFeatureUnderMouse } = self
              if (!apolloFeatureUnderMouse) {
                return
              }
              self.featureLayouts.forEach((featureLayout, idx) => {
                const displayedRegion = self.displayedRegions[idx]
                featureLayout.forEach((featureLayoutRow, row) => {
                  featureLayoutRow.forEach(([featureRow, feature]) => {
                    if (featureRow > 0) {
                      return
                    }
                    if (feature._id !== apolloFeatureUnderMouse._id) {
                      return
                    }
                    const x =
                      (self.lgv.bpToPx({
                        refName: displayedRegion.refName,
                        coord: feature.min,
                        regionNumber: idx,
                      })?.offsetPx || 0) - self.lgv.offsetPx
                    draw(
                      feature,
                      ctx,
                      x,
                      row * self.apolloRowHeight,
                      self.lgv.bpPerPx,
                      self.apolloRowHeight,
                      displayedRegion.reversed,
                    )
                  })
                })
              })
            },
            { name: 'LinearApolloDisplayRenderMouseoverAndDrag' },
          ),
        )

        addDisposer(
          self,
          autorun(
            () => {
              if (!self.lgv.initialized || self.regionCannotBeRendered()) {
                return
              }
              const ctx = self.overlayCanvas?.getContext('2d')
              if (!ctx) {
                return
              }
              for (const collaborator of self.session
                .collaborators as Collaborator[]) {
                const { locations } = collaborator
                if (!locations.length) {
                  continue
                }
                for (const location of locations) {
                  const { start, end, refName } = location
                  const locationStartPxInfo = self.lgv.bpToPx({
                    refName,
                    coord: start,
                  })
                  if (!locationStartPxInfo) {
                    continue
                  }
                  const locationStartPx =
                    locationStartPxInfo.offsetPx - self.lgv.offsetPx
                  const locationWidthPx = (end - start) / self.lgv.bpPerPx
                  ctx.fillStyle = 'rgba(0,255,0,.2)'
                  ctx.fillRect(locationStartPx, 1, locationWidthPx, 100)
                  ctx.fillStyle = 'black'
                  ctx.fillText(
                    collaborator.name,
                    locationStartPx + 1,
                    11,
                    locationWidthPx - 2,
                  )
                }
              }
            },
            { name: 'LinearApolloDisplayRenderCollaborators' },
          ),
        )
      },
    }))
}

export type LinearApolloDisplayStateModel = ReturnType<typeof stateModelFactory>
export type LinearApolloDisplay = Instance<LinearApolloDisplayStateModel>
