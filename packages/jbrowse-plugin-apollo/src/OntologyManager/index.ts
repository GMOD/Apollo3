import {
  BlobLocation,
  LocalPathLocation,
  UriLocation,
} from '@jbrowse/core/util/types/mst'
import { types } from 'mobx-state-tree'

import OntologyStore from './OntologyStore'

export const OntologyRecordType = types
  .model('OntologyRecord', {
    name: types.string,
    version: types.string,
    source: types.union(LocalPathLocation, UriLocation, BlobLocation),
  })
  .views((self) => ({
    get dataStore() {
      return new OntologyStore(self.name, self.version, self.source)
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
  .actions((self) => ({}))

export default OntologyManagerType
