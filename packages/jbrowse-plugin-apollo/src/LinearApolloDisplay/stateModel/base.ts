/* eslint-disable @typescript-eslint/unbound-method */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unnecessary-condition */
import { ConfigurationReference, getConf } from '@jbrowse/core/configuration'
import { AnyConfigurationSchemaType } from '@jbrowse/core/configuration/configurationSchema'
import { BaseDisplay } from '@jbrowse/core/pluggableElementTypes'
import PluginManager from '@jbrowse/core/PluginManager'
import {
  AbstractSessionModel,
  getContainingView,
  getSession,
} from '@jbrowse/core/util'
import { getParentRenderProps } from '@jbrowse/core/util/tracks'
// import type LinearGenomeViewPlugin from '@jbrowse/plugin-linear-genome-view'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'
import { AnnotationFeatureI } from 'apollo-mst'
import { autorun } from 'mobx'
import { addDisposer, getRoot, types } from 'mobx-state-tree'

import { ApolloInternetAccountModel } from '../../ApolloInternetAccount/model'
import { ApolloSessionModel } from '../../session'
import { ApolloRootModel } from '../../types'
import { TrackHeightMixin } from './trackHeightMixin'

export function baseModelFactory(
  _pluginManager: PluginManager,
  configSchema: AnyConfigurationSchemaType,
) {
  // TODO: Restore this when TRackHeightMixin is in LGV runtime exports

  // const LGVPlugin = pluginManager.getPlugin(
  //   'LinearGenomeViewPlugin',
  // ) as LinearGenomeViewPlugin
  // const { TrackHeightMixin } = LGVPlugin.exports

  return types
    .compose(BaseDisplay, TrackHeightMixin)
    .named('BaseLinearApolloDisplay')
    .props({
      type: types.literal('LinearApolloDisplay'),
      configuration: ConfigurationReference(configSchema),
    })
    .volatile((self) => ({
      lgv: getContainingView(self) as unknown as LinearGenomeViewModel,
    }))
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
      get displayedRegions() {
        return self.lgv.displayedRegions
      },
      regionCannotBeRendered(/* region */) {
        if (self.lgv && self.lgv.bpPerPx >= 200) {
          return 'Zoom in to see annotations'
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
      get selectedFeature(): AnnotationFeatureI | undefined {
        return (self.session as unknown as ApolloSessionModel)
          .apolloSelectedFeature
      },
    }))
    .actions((self) => ({
      setSelectedFeature(feature?: AnnotationFeatureI) {
        ;(
          self.session as unknown as ApolloSessionModel
        ).apolloSetSelectedFeature(feature)
      },
      afterAttach() {
        addDisposer(
          self,
          autorun(
            () => {
              if (!self.lgv.initialized || self.regionCannotBeRendered()) {
                return
              }
              void (
                self.session as unknown as ApolloSessionModel
              ).apolloDataStore.loadFeatures(self.regions)
              void (
                self.session as unknown as ApolloSessionModel
              ).apolloDataStore.loadRefSeq(self.regions)
            },
            { name: 'LinearApolloDisplayLoadFeatures', delay: 1000 },
          ),
        )
      },
    }))
}
