import {
  LocalGFF3DataStore,
  Operation,
  SerializedOperation,
  ServerDataStore,
} from './abstract'

interface SerializedGetOntologyTermsOperation extends SerializedOperation {
  typeName: 'GetOntologyTermsOperation'
}

export class GetOntologyTermsOperation extends Operation {
  typeName = 'GetOntologyTermsOperation' as const

  toJSON(): SerializedGetOntologyTermsOperation {
    const { typeName } = this
    return { typeName }
  }

  executeOnServer(backend: ServerDataStore) {
    return backend.ontologyService.getPossibleChildTypes('mRNA')
  }

  async executeOnLocalGFF3(backend: LocalGFF3DataStore) {
    throw new Error('executeOnLocalGFF3 not implemented')
  }
}

