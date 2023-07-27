import { ConfigurationSchema } from '@jbrowse/core/configuration'
import {
  BlobLocation,
  LocalPathLocation,
  UriLocation,
} from '@jbrowse/core/util/types/mst'
import { autorun } from 'mobx'
import { Instance, addDisposer, getSnapshot, types } from 'mobx-state-tree'

import OntologyStore from './OntologyStore'
import { OntologyDBNode } from './OntologyStore/indexeddb-schema'

export { isDeprecated } from './OntologyStore/indexeddb-schema'

export const OntologyRecordType = types
  .model('OntologyRecord', {
    name: types.string,
    version: 'unversioned',
    source: types.union(LocalPathLocation, UriLocation, BlobLocation),
  })
  .volatile((self) => ({
    dataStore: undefined as undefined | OntologyStore,
  }))
  .actions((self) => ({
    ping() {
      return // does nothing, just forces access
    },
    initDataStore() {
      self.dataStore = new OntologyStore(
        self.name,
        self.version,
        getSnapshot(self.source),
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
    prefixes: types.map(types.string),
  })
  .views((self) => ({
    /**
     * gets the OntologyRecord for the ontology we should be
     * using for feature types (e.g. SO or maybe biotypes)
     **/
    get featureTypeOntology() {
      // TODO: change this to read some configuration for which feature type ontology
      // we should be using. currently hardcoded to use SO.
      return this.findOntology('Sequence Ontology')
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
      // TODO: compact the URI using our configured prefixes
      return uri
    },
    /**
     * expand the given compacted URI using the currently
     * configured prefixes
     */
    expandPrefixes(uri: string) {
      // TODO: expand the prefixes in the given URI
      return uri
    },
  }))
  .actions((self) => ({
    addOntology(
      name: string,
      version: string,
      source: Instance<typeof LocalPathLocation> | Instance<typeof UriLocation>,
    ) {
      const newlen = self.ontologies.push({ name, version, source })
      // access it immediately to fire its lifecycle hooks
      // (see https://github.com/mobxjs/mobx-state-tree/issues/1665)
      self.ontologies[newlen - 1].ping()
    },
  }))

export default OntologyManagerType

export const OntologyRecordConfiguration = ConfigurationSchema(
  'OntologyRecord',
  {
    name: {
      type: 'string',
      description: 'the full name of the ontology, e.g. "Gene Ontology"',
      defaultValue: 'My Ontology',
    },
    prefix: {
      type: 'string',
      description: 'the identifier prefix used for the ontology, e.g. "GO"',
      defaultValue: 'MY',
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
  },
)

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
