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
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'
import { AnnotationFeatureNew } from 'apollo-mst'
import { autorun } from 'mobx'
import { addDisposer, getRoot, types } from 'mobx-state-tree'

import { ApolloInternetAccountModel } from '../../ApolloInternetAccount/model'
import { OntologyManager } from '../../OntologyManager'
import OntologyStore from '../../OntologyManager/OntologyStore'
import { ApolloSessionModel } from '../../session'
import { ApolloRootModel } from '../../types'
import { TrackHeightMixin } from './trackHeightMixin'

async function getSynonyms(
  label: string,
  ontologyStore?: OntologyStore,
): Promise<string[]> {
  if (!ontologyStore) {
    return []
  }
  try {
    return await ontologyStore
      .getTermsWithLabelOrSynonym(label)
      .then((terms) => terms.map((term) => term.lbl))
      .then((synonyms) =>
        synonyms.filter((synonym): synonym is string => synonym !== undefined),
      )
  } catch {
    return []
  }
}

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
      geneSynonyms: types.array(types.string),
      mRNASynonyms: types.array(types.string),
      exonSynonyms: types.array(types.string),
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
          ?.changeManager
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
      get selectedFeature(): AnnotationFeatureNew | undefined {
        return (self.session as unknown as ApolloSessionModel)
          .apolloSelectedFeature
      },
    }))
    .actions((self) => ({
      setSynonyms(type: string, synonyms: string[]) {
        switch (type) {
          case 'gene': {
            self.geneSynonyms.replace(synonyms)
            break
          }
          case 'mRNA': {
            self.mRNASynonyms.replace(synonyms)
            break
          }
          case 'exon': {
            self.exonSynonyms.replace(synonyms)
            break
          }
          default: {
            break
          }
        }
      },
    }))
    .actions((self) => ({
      setSelectedFeature(feature?: AnnotationFeatureNew) {
        return (
          self.session as unknown as ApolloSessionModel
        ).apolloSetSelectedFeature(feature)
      },
      afterAttach() {
        addDisposer(
          self,
          autorun(
            async () => {
              if (!self.lgv.initialized || self.regionCannotBeRendered()) {
                return
              }
              void (
                self.session as unknown as ApolloSessionModel
              ).apolloDataStore.loadFeatures(self.regions)
              void (
                self.session as unknown as ApolloSessionModel
              ).apolloDataStore.loadRefSeq(self.regions)

              const { apolloDataStore } = self.session
              const ontologyManager =
                apolloDataStore.ontologyManager as OntologyManager
              const ontologyStore =
                ontologyManager.findOntology('Sequence Ontology')?.dataStore

              const geneSynonyms = await getSynonyms('gene', ontologyStore)
              const mRNASynonyms = await getSynonyms('mRNA', ontologyStore)
              const exonSynonyms = await getSynonyms('exon', ontologyStore)

              self.setSynonyms('gene', geneSynonyms)
              self.setSynonyms('mRNA', mRNASynonyms)
              self.setSynonyms('exon', exonSynonyms)
            },
            { name: 'LinearApolloDisplayLoadFeatures', delay: 1000 },
          ),
        )
      },
    }))
}
