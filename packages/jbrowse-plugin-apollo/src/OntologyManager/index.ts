import {
  type AnyConfigurationModel,
  ConfigurationSchema,
  readConfObject,
} from '@jbrowse/core/configuration'
import {
  BlobLocation,
  LocalPathLocation,
  UriLocation,
} from '@jbrowse/core/util/types/mst'
import { autorun } from 'mobx'
import {
  type Instance,
  addDisposer,
  flow,
  getRoot,
  getSnapshot,
  types,
} from 'mobx-state-tree'

import type ApolloPluginConfigurationSchema from '../config'
import { type ApolloRootModel } from '../types'

import OntologyStore, { type OntologyStoreOptions } from './OntologyStore'
import { type OntologyDBNode } from './OntologyStore/indexeddb-schema'
import { applyPrefixes, expandPrefixes } from './OntologyStore/prefixes'

export { isDeprecated } from './OntologyStore/indexeddb-schema'

export const OntologyRecordType = types
  .model('OntologyRecord', {
    name: types.string,
    version: 'unversioned',
    source: types.union(LocalPathLocation, UriLocation, BlobLocation),
    options: types.frozen<OntologyStoreOptions>(),
    equivalentTypes: types.map(types.array(types.string)),
  })
  .volatile((_self) => ({
    dataStore: undefined as undefined | OntologyStore,
    startedEquivalentTypeRequests: new Set<string>(),
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
    setEquivalentTypes(type: string, equivalentTypes: string[]) {
      self.equivalentTypes.set(type, equivalentTypes)
    },
  }))
  .actions((self) => ({
    loadEquivalentTypes: flow(function* loadEquivalentTypes(type: string) {
      if (!self.dataStore) {
        return
      }
      if (self.startedEquivalentTypeRequests.has(type)) {
        return
      }
      self.startedEquivalentTypeRequests.add(type)
      const terms = (yield self.dataStore.getTermsWithLabelOrSynonym(
        type,
      )) as unknown as OntologyTerm[]
      const equivalents: string[] = terms
        .map((term) => term.lbl)
        .filter((term) => term != undefined)
      self.setEquivalentTypes(type, equivalents)
    }),
  }))
  .actions((self) => ({
    afterCreate() {
      autorun((reaction) => {
        if (!self.dataStore) {
          return
        }
        void self.loadEquivalentTypes('gene')
        void self.loadEquivalentTypes('pseudogene')
        void self.loadEquivalentTypes('transcript')
        void self.loadEquivalentTypes('pseudogenic_transcript')
        void self.loadEquivalentTypes('CDS')
        void self.loadEquivalentTypes('mRNA')
        reaction.dispose()
      })
    },
    setEquivalentTypes(type: string, equivalentTypes: string[]) {
      self.equivalentTypes.set(type, equivalentTypes)
    },
  }))
  .views((self) => ({
    isTypeOf(queryType: string, typeOf: string): boolean {
      if (queryType === typeOf) {
        return true
      }
      if (!self.dataStore) {
        return false
      }
      const equivalents = self.equivalentTypes.get(typeOf)
      if (!equivalents) {
        void self.loadEquivalentTypes(typeOf)
        return false
      }
      return equivalents.includes(queryType)
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
  })
  .views((self) => ({
    get featureTypeOntologyName(): string {
      const jbConfig = getRoot<ApolloRootModel>(self).jbrowse
        .configuration as AnyConfigurationModel
      const pluginConfiguration = jbConfig.ApolloPlugin as Instance<
        typeof ApolloPluginConfigurationSchema
      >
      const featureTypeOntologyName = readConfObject(
        pluginConfiguration,
        'featureTypeOntologyName',
      ) as string
      return featureTypeOntologyName
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

export interface TextIndexFieldDefinition {
  /** name to display in the UI for text taken from this field or fields */
  displayName: string
  /** JSONPath of the field(s) */
  jsonPath: string
}
export const defaultTextIndexFields: TextIndexFieldDefinition[] = [
  { displayName: 'Label', jsonPath: '$.lbl' },
  { displayName: 'Synonym', jsonPath: '$.meta.synonyms[*].val' },
  { displayName: 'Definition', jsonPath: '$.meta.definition.val' },
]

export const OntologyRecordConfiguration = ConfigurationSchema(
  'OntologyRecord',
  {
    name: {
      type: 'string',
      description: 'the full name of the ontology, e.g. "Gene Ontology"',
      defaultValue: 'My Ontology',
    },
    version: {
      type: 'string',
      description: "the ontology's version string",
      defaultValue: 'unversioned',
    },
    source: {
      type: 'fileLocation',
      description: "the download location for the ontology's source file",
      defaultValue: {
        locationType: 'UriLocation',
        uri: 'http://example.com/myontology.json',
      },
    },
    textIndexFields: {
      type: 'frozen',
      description:
        'JSON paths for text fields that will be indexed for text searching',
      defaultValue: defaultTextIndexFields,
    },
  },
)

// eslint disables because of
// https://mobx-state-tree.js.org/tips/typescript#using-a-mst-type-at-design-time
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface OntologyManager extends Instance<typeof OntologyManagerType> {}
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
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
