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
import { Theme } from '@mui/material'
import { AnnotationFeatureI } from 'apollo-mst'
import { autorun, observable } from 'mobx'
import { Instance, addDisposer, getRoot, types } from 'mobx-state-tree'

import { ApolloInternetAccountModel } from '../ApolloInternetAccount/model'
import {
  AddFeature,
  DeleteFeature,
  ModifyFeatureAttribute,
} from '../components'
import { Collaborator } from '../session'
import { BoxGlyph, CanonicalGeneGlyph, ImplicitExonGeneGlyph } from './glyphs'
import { Glyph } from './glyphs/Glyph'
import mouseEvents, {
  RestOfLinearApolloDisplayStateModelTemporaryDeleteMeAsap,
} from './stateModel/mouse-events'

const boxGlyph = new BoxGlyph()
const canonicalGeneGlyph = new CanonicalGeneGlyph()
const implicitExonGeneGlyph = new ImplicitExonGeneGlyph()

export function stateModelFactory(
  pluginManager: PluginManager,
  configSchema: AnyConfigurationSchemaType,
) {
  const LGVPlugin = pluginManager.getPlugin(
    'LinearGenomeViewPlugin',
  ) as LinearGenomeViewPlugin
  const { BaseLinearDisplay } = LGVPlugin.exports

  return types
    .compose('LinearApolloDisplay', BaseLinearDisplay, mouseEvents)
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
      theme: undefined as Theme | undefined,
    }))
    .actions((self) => ({
      addSeenFeature(feature: AnnotationFeatureI) {
        self.seenFeatures.set(feature._id, feature)
      },
      setCanvas(canvas: HTMLCanvasElement | null) {
        self.canvas = canvas
      },
      setTheme(theme: Theme) {
        self.theme = theme
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
      /** get the appropriate glyph for the given top-level feature */
      getGlyph(feature: AnnotationFeatureI, bpPerPx: number): Glyph {
        if (feature.type === 'gene') {
          let hasExon = false
          feature.children?.forEach((mrna: AnnotationFeatureI) => {
            if (mrna.type !== 'mRNA') {
              return
            }
            mrna.children?.forEach((possibleExon: AnnotationFeatureI) => {
              if (possibleExon.type === 'exon') {
                hasExon = true
              }
            })
          })
          if (hasExon) {
            return canonicalGeneGlyph
          }
          return implicitExonGeneGlyph
        }
        return boxGlyph
      },
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
            const rowCount = self
              .getGlyph(feature, self.lgv.bpPerPx)
              .getRowCount(feature, self.lgv.bpPerPx)
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
        return (this.highestRow + 1) * self.apolloRowHeight
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
    }))
    .actions((self) => ({
      setOverlayCanvas(canvas: HTMLCanvasElement | null) {
        self.overlayCanvas = canvas
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
                    self
                      .getGlyph(feature, self.lgv.bpPerPx)
                      .draw(
                        self,
                        ctx,
                        feature,
                        x,
                        row * self.apolloRowHeight,
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

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function checkInterface(
  m: LinearApolloDisplay,
): RestOfLinearApolloDisplayStateModelTemporaryDeleteMeAsap {
  // this function just checks that LinearApolloDisplay satisfies the
  // temporary interface for the mouse events.
  // remove this when removing that hack interface
  return m
}
