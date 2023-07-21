import { ConfigurationSchema } from '@jbrowse/core/configuration'
import {
  BlobLocation,
  LocalPathLocation,
  UriLocation,
} from '@jbrowse/core/util/types/mst'
import { autorun } from 'mobx'
import { Instance, addDisposer, getSnapshot, types } from 'mobx-state-tree'

import OntologyStore from './OntologyStore'

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
    openOntology(name: string, version?: string) {
      const ont = self.ontologies.find((record) => {
        return (
          record.name === name &&
          (version === undefined || record.version === version)
        )
      })
      return ont?.dataStore
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
