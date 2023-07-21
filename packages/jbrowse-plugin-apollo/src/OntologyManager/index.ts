import { ConfigurationSchema } from '@jbrowse/core/configuration'
import {
  BlobLocation,
  LocalPathLocation,
  UriLocation,
} from '@jbrowse/core/util/types/mst'
import { Instance, getSnapshot, types } from 'mobx-state-tree'

import OntologyStore from './OntologyStore'

export const OntologyRecordType = types
  .model('OntologyRecord', {
    name: types.string,
    prefix: types.string,
    version: 'unversioned',
    source: types.union(LocalPathLocation, UriLocation, BlobLocation),
  })
  .views((self) => ({
    get dataStore() {
      return new OntologyStore(
        self.name,
        self.prefix,
        self.version,
        getSnapshot(self.source),
      )
    },
  }))

export const OntologyManagerType = types
  .model('OntologyManager', {
    // create, update, and delete ontologies
    ontologies: types.array(OntologyRecordType),
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
      prefix: string,
      version: string,
      source: Instance<typeof LocalPathLocation> | Instance<typeof UriLocation>,
    ) {
      self.ontologies.push({ name, prefix, version, source })
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
