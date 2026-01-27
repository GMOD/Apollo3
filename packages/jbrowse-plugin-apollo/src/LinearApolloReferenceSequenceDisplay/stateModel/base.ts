/* eslint-disable @typescript-eslint/unbound-method */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unnecessary-condition */
import { type AnnotationFeature } from '@apollo-annotation/mst'
import type PluginManager from '@jbrowse/core/PluginManager'
import {
  type AnyConfigurationSchemaType,
  ConfigurationReference,
  getConf,
} from '@jbrowse/core/configuration'
import { BaseDisplay } from '@jbrowse/core/pluggableElementTypes'
import {
  type AbstractSessionModel,
  getContainingView,
  getSession,
} from '@jbrowse/core/util'
import { getParentRenderProps } from '@jbrowse/core/util/tracks'
// import type LinearGenomeViewPlugin from '@jbrowse/plugin-linear-genome-view'
import { addDisposer, getRoot, types } from '@jbrowse/mobx-state-tree'
import { type LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'
import { autorun } from 'mobx'

import { type ApolloInternetAccountModel } from '../../ApolloInternetAccount/model'
import { type ApolloSessionModel, type HoveredFeature } from '../../session'
import { type ApolloRootModel } from '../../types'

const minDisplayHeight = 20

export function baseModelFactory(
  _pluginManager: PluginManager,
  configSchema: AnyConfigurationSchemaType,
) {
  return BaseDisplay.named('BaseLinearApolloReferenceSequenceDisplay')
    .props({
      type: types.literal('LinearApolloReferenceSequenceDisplay'),
      configuration: ConfigurationReference(configSchema),
      showStartCodons: false,
      showStopCodons: true,
      highContrast: false,
      heightPreConfig: types.maybe(
        types.refinement(
          'displayHeight',
          types.number,
          (n) => n >= minDisplayHeight,
        ),
      ),
      sequenceRowHeight: 15,
    })
    .views((self) => {
      const { configuration, renderProps: superRenderProps } = self
      return {
        renderProps() {
          return {
            ...superRenderProps(),
            ...getParentRenderProps(self),
            config: configuration.renderer,
          }
        },
      }
    })
    .views((self) => ({
      get lgv() {
        return getContainingView(self) as unknown as LinearGenomeViewModel
      },
    }))
    .views((self) => ({
      get rendererTypeName() {
        return self.configuration.renderer.type
      },
      get session() {
        return getSession(self) as unknown as ApolloSessionModel
      },
      get regions() {
        const regions = self.lgv.dynamicBlocks.contentBlocks.map(
          ({ assemblyName, end, refName, start }) => ({
            assemblyName,
            refName,
            start: Math.round(start),
            end: Math.round(end),
          }),
        )
        return regions
      },
      regionCannotBeRendered(/* region */) {
        if (self.lgv && self.lgv.bpPerPx >= 3) {
          return 'Zoom in to see sequence'
        }
        return
      },
    }))
    .views((self) => ({
      get apolloInternetAccount() {
        const [region] = self.regions
        const { internetAccounts } = getRoot<ApolloRootModel>(self)
        const { assemblyName } = region
        const { assemblyManager } =
          self.session as unknown as AbstractSessionModel
        const assembly = assemblyManager.get(assemblyName)
        if (!assembly) {
          throw new Error(`No assembly found with name ${assemblyName}`)
        }
        const { internetAccountConfigId } = getConf(assembly, [
          'sequence',
          'metadata',
        ]) as { internetAccountConfigId: string }
        return internetAccounts.find(
          (ia) => getConf(ia, 'internetAccountId') === internetAccountConfigId,
        ) as ApolloInternetAccountModel | undefined
      },
      get changeManager() {
        return (self.session as unknown as ApolloSessionModel).apolloDataStore
          .changeManager
      },
      getAssemblyId(assemblyName: string) {
        const { assemblyManager } =
          self.session as unknown as AbstractSessionModel
        const assembly = assemblyManager.get(assemblyName)
        if (!assembly) {
          throw new Error(`Could not find assembly named ${assemblyName}`)
        }
        return assembly.name
      },
      get selectedFeature(): AnnotationFeature | undefined {
        return (self.session as unknown as ApolloSessionModel)
          .apolloSelectedFeature
      },
      get hoveredFeature(): HoveredFeature | undefined {
        return (self.session as unknown as ApolloSessionModel)
          .apolloHoveredFeature
      },
      get height() {
        const { sequenceRowHeight } = self
        return self.lgv.bpPerPx <= 1
          ? sequenceRowHeight * 8
          : sequenceRowHeight * 6
      },
    }))
    .volatile(() => ({
      scrollTop: 0,
    }))
    .actions((self) => ({
      setScrollTop(scrollTop: number) {
        self.scrollTop = scrollTop
      },
      setHeight(displayHeight: number) {
        self.heightPreConfig = Math.max(displayHeight, minDisplayHeight)
        return self.height
      },
      resizeHeight(distance: number) {
        const oldHeight = self.height
        const newHeight = this.setHeight(self.height + distance)
        return newHeight - oldHeight
      },
      toggleShowStartCodons() {
        self.showStartCodons = !self.showStartCodons
      },
      toggleShowStopCodons() {
        self.showStopCodons = !self.showStopCodons
      },
      toggleHighContrast() {
        self.highContrast = !self.highContrast
      },
    }))
    .views((self) => {
      const { trackMenuItems: superTrackMenuItems } = self
      return {
        trackMenuItems() {
          const { showStartCodons, showStopCodons, highContrast } = self
          return [
            ...superTrackMenuItems(),
            {
              type: 'subMenu',
              label: 'Appearance',
              subMenu: [
                {
                  label: 'Show start codons',
                  type: 'checkbox',
                  checked: showStartCodons,
                  onClick: () => {
                    self.toggleShowStartCodons()
                  },
                },
                {
                  label: 'Show stop codons',
                  type: 'checkbox',
                  checked: showStopCodons,
                  onClick: () => {
                    self.toggleShowStopCodons()
                  },
                },
                {
                  label: 'Use high contrast colors',
                  type: 'checkbox',
                  checked: highContrast,
                  onClick: () => {
                    self.toggleHighContrast()
                  },
                },
              ],
            },
          ]
        },
      }
    })
    .actions((self) => ({
      afterAttach() {
        addDisposer(
          self,
          autorun(
            () => {
              if (!self.lgv.initialized || self.regionCannotBeRendered()) {
                return
              }
              if (self.lgv.bpPerPx <= 3) {
                void (
                  self.session as unknown as ApolloSessionModel
                ).apolloDataStore.loadRefSeq(self.regions)
              }
            },
            {
              name: 'LinearApolloReferenceSequenceDisplayLoadFeatures',
              delay: 1000,
            },
          ),
        )
      },
    }))
}
