import {
  ConfigurationReference,
  readConfObject,
} from '@jbrowse/core/configuration'
import {
  BlobLocation,
  LocalPathLocation,
  UriLocation,
} from '@jbrowse/core/util/types/mst'
import { autorun } from 'mobx'
import { Instance, addDisposer, getSnapshot, types } from 'mobx-state-tree'

import OntologyStore, { OntologyStoreOptions } from './OntologyStore'
import { OntologyDBNode } from './OntologyStore/indexeddb-schema'
import { applyPrefixes, expandPrefixes } from './OntologyStore/prefixes'

import ApolloPluginConfigurationSchema from '../config'

export { isDeprecated } from './OntologyStore/indexeddb-schema'

export const OntologyRecordType = types
  .model('OntologyRecord', {
    name: types.string,
    version: 'unversioned',
    source: types.union(LocalPathLocation, UriLocation, BlobLocation),
    options: types.frozen<OntologyStoreOptions>(),
  })
  .volatile((_self) => ({
    dataStore: undefined as undefined | OntologyStore,
  }))
  .actions((self) => ({
    /** does nothing, just used to access the model to force its lifecycle hooks to run */
    ping() {
      return
    },
    initDataStore() {
      self.dataStore = new OntologyStore(
        self.name,
        self.version,
        getSnapshot(self.source),
        self.options,
      )
    },
    afterCreate() {
      addDisposer(
        self,
        autorun(() => {
          this.initDataStore()
        }),
      )
    },
  }))

export const OntologyManagerType = types
  .model('OntologyManager', {
    // create, update, and delete ontologies
    ontologies: types.array(OntologyRecordType),
    prefixes: types.optional(types.map(types.string), {
      'GO:': 'http://purl.obolibrary.org/obo/GO_',
      'SO:': 'http://purl.obolibrary.org/obo/SO_',
    }),
    pluginConfiguration: ConfigurationReference(
      ApolloPluginConfigurationSchema,
    ),
  })
  .views((self) => ({
    get featureTypeOntologyName(): string {
      return readConfObject(
        self.pluginConfiguration,
        'featureTypeOntologyName',
      ) as string
    },
  }))
  .views((self) => ({
    /**
     * gets the OntologyRecord for the ontology we should be
     * using for feature types (e.g. SO or maybe biotypes)
     **/
    get featureTypeOntology() {
      return this.findOntology(self.featureTypeOntologyName)
    },

    findOntology(name: string, version?: string) {
      return self.ontologies.find((record) => {
        return (
          record.name === name &&
          (version === undefined || record.version === version)
        )
      })
    },
    openOntology(name: string, version?: string) {
      return this.findOntology(name, version)?.dataStore
    },
    /**
     * compact the given URI using the currently configured
     * prefixes
     */
    applyPrefixes(uri: string) {
      return applyPrefixes(uri, self.prefixes)
    },
    /**
     * expand the given compacted URI using the currently
     * configured prefixes
     */
    expandPrefixes(uri: string) {
      return expandPrefixes(uri, self.prefixes)
    },
  }))
  .actions((self) => ({
    addOntology(
      name: string,
      version: string,
      source: Instance<typeof LocalPathLocation> | Instance<typeof UriLocation>,
      options?: OntologyStoreOptions,
    ) {
      const newlen = self.ontologies.push({
        name,
        version,
        source,
        options: { prefixes: new Map(self.prefixes.entries()), ...options },
      })
      // access it immediately to fire its lifecycle hooks
      // (see https://github.com/mobxjs/mobx-state-tree/issues/1665)
      self.ontologies[newlen - 1].ping()
    },
  }))

export default OntologyManagerType

// eslint disables because of
// https://mobx-state-tree.js.org/tips/typescript#using-a-mst-type-at-design-time
// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface OntologyManager extends Instance<typeof OntologyManagerType> {}
// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface OntologyRecord extends Instance<typeof OntologyRecordType> {}

export type OntologyTerm = OntologyDBNode

export type OntologyClass = OntologyTerm & { type: 'CLASS' }
export function isOntologyClass(term: OntologyTerm): term is OntologyClass {
  return term.type === 'CLASS'
}

export type OntologyProperty = OntologyTerm & { type: 'PROPERTY' }
export function isOntologyProperty(
  term: OntologyTerm,
): term is OntologyProperty {
  return term.type === 'PROPERTY'
}
