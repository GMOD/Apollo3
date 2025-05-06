/* eslint-disable @typescript-eslint/unbound-method */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unnecessary-condition */
import { AnnotationFeature } from '@apollo-annotation/mst'
import { ConfigurationReference, getConf } from '@jbrowse/core/configuration'
import { AnyConfigurationSchemaType } from '@jbrowse/core/configuration/configurationSchema'
import { BaseDisplay } from '@jbrowse/core/pluggableElementTypes'
import PluginManager from '@jbrowse/core/PluginManager'
import {
  AbstractSessionModel,
  getContainingView,
  getSession,
  SessionWithWidgets,
} from '@jbrowse/core/util'
import { getParentRenderProps } from '@jbrowse/core/util/tracks'
// import type LinearGenomeViewPlugin from '@jbrowse/plugin-linear-genome-view'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'
import { autorun } from 'mobx'
import { addDisposer, cast, getRoot, types, getSnapshot } from 'mobx-state-tree'

import { ApolloInternetAccountModel } from '../../ApolloInternetAccount/model'
import { ApolloSessionModel } from '../../session'
import { ApolloRootModel } from '../../types'
import { FilterFeatures } from '../../components/FilterFeatures'

const minDisplayHeight = 20

export function baseModelFactory(
  _pluginManager: PluginManager,
  configSchema: AnyConfigurationSchemaType,
) {
  return BaseDisplay.named('BaseLinearApolloDisplay')
    .props({
      type: types.literal('LinearApolloDisplay'),
      configuration: ConfigurationReference(configSchema),
      graphical: true,
      table: false,
      heightPreConfig: types.maybe(
        types.refinement(
          'displayHeight',
          types.number,
          (n) => n >= minDisplayHeight,
        ),
      ),
      filteredFeatureTypes: types.array(types.string),
      loadingState: false,
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
    .volatile(() => ({
      scrollTop: 0,
    }))
    .views((self) => ({
      get lgv() {
        return getContainingView(self) as unknown as LinearGenomeViewModel
      },
      get height() {
        if (self.heightPreConfig) {
          return self.heightPreConfig
        }
        if (self.graphical && self.table) {
          return 500
        }
        if (self.graphical) {
          return 200
        }
        return 300
      },
      get loading() {
        return self.loadingState
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
      get selectedFeature(): AnnotationFeature | undefined {
        return (self.session as unknown as ApolloSessionModel)
          .apolloSelectedFeature
      },
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
      showGraphicalOnly() {
        self.graphical = true
        self.table = false
      },
      showTableOnly() {
        self.graphical = false
        self.table = true
      },
      showGraphicalAndTable() {
        self.graphical = true
        self.table = true
      },
      updateFilteredFeatureTypes(types: string[]) {
        self.filteredFeatureTypes = cast(types)
      },
      setLoading(loading: boolean) {
        self.loadingState = loading
      },
    }))
    .views((self) => {
      const { filteredFeatureTypes, trackMenuItems: superTrackMenuItems } = self
      return {
        trackMenuItems() {
          const { graphical, table } = self
          return [
            ...superTrackMenuItems(),
            {
              type: 'subMenu',
              label: 'Appearance',
              subMenu: [
                {
                  label: 'Show graphical display',
                  type: 'radio',
                  checked: graphical && !table,
                  onClick: () => {
                    self.showGraphicalOnly()
                  },
                },
                {
                  label: 'Show table display',
                  type: 'radio',
                  checked: table && !graphical,
                  onClick: () => {
                    self.showTableOnly()
                  },
                },
                {
                  label: 'Show both graphical and table display',
                  type: 'radio',
                  checked: table && graphical,
                  onClick: () => {
                    self.showGraphicalAndTable()
                  },
                },
              ],
            },
            {
              label: 'Filter features by type',
              onClick: () => {
                const session = self.session as unknown as ApolloSessionModel
                ;(self.session as unknown as AbstractSessionModel).queueDialog(
                  (doneCallback) => [
                    FilterFeatures,
                    {
                      session,
                      handleClose: () => {
                        doneCallback()
                      },
                      featureTypes: getSnapshot(filteredFeatureTypes),
                      onUpdate: (types: string[]) => {
                        self.updateFilteredFeatureTypes(types)
                      },
                    },
                  ],
                )
              },
            },
          ]
        },
      }
    })
    .actions((self) => ({
      setSelectedFeature(feature?: AnnotationFeature) {
        ;(
          self.session as unknown as ApolloSessionModel
        ).apolloSetSelectedFeature(feature)
      },
      showFeatureDetailsWidget(feature: AnnotationFeature) {
        const { session } = self
        const { changeManager } = session.apolloDataStore
        const [region] = self.regions
        const { assemblyName, refName } = region
        const assembly = self.getAssemblyId(assemblyName)
        if (!assembly) {
          return
        }
        const { apolloDataStore } = session
        const { featureTypeOntology } = apolloDataStore.ontologyManager
        if (!featureTypeOntology) {
          throw new Error('featureTypeOntology is undefined')
        }

        let containsCDSOrExon = false
        for (const [, child] of feature.children ?? []) {
          if (
            featureTypeOntology.isTypeOf(child.type, 'CDS') ||
            featureTypeOntology.isTypeOf(child.type, 'exon')
          ) {
            containsCDSOrExon = true
            break
          }
        }

        if (
          (featureTypeOntology.isTypeOf(feature.type, 'transcript') ||
            featureTypeOntology.isTypeOf(
              feature.type,
              'pseudogenic_transcript',
            )) &&
          containsCDSOrExon
        ) {
          const apolloTranscriptWidget = (
            session as unknown as SessionWithWidgets
          ).addWidget('ApolloTranscriptDetails', 'apolloTranscriptDetails', {
            feature,
            assembly,
            refName,
            changeManager,
          })
          ;(session as unknown as SessionWithWidgets).showWidget(
            apolloTranscriptWidget,
          )
        } else {
          const apolloFeatureWidget = (
            session as unknown as SessionWithWidgets
          ).addWidget(
            'ApolloFeatureDetailsWidget',
            'apolloFeatureDetailsWidget',
            {
              feature,
              assembly,
              refName,
              changeManager,
            },
          )
          ;(session as unknown as SessionWithWidgets).showWidget(
            apolloFeatureWidget,
          )
        }
      },
      afterAttach() {
        addDisposer(
          self,
          autorun(
            () => {
              if (!self.lgv.initialized || self.regionCannotBeRendered()) {
                return
              }
              self.setLoading(true)
              void (
                self.session as unknown as ApolloSessionModel
              ).apolloDataStore
                .loadFeatures(self.regions)
                .then(() => {
                  setTimeout(() => {
                    self.setLoading(false)
                  }, 1000)
                })
              if (self.lgv.bpPerPx <= 3) {
                void (
                  self.session as unknown as ApolloSessionModel
                ).apolloDataStore.loadRefSeq(self.regions)
              }
            },
            { name: 'LinearApolloDisplayLoadFeatures', delay: 1000 },
          ),
        )
      },
    }))
}
