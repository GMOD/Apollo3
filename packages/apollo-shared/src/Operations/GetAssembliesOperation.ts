import {
  LocalGFF3DataStore,
  Operation,
  SerializedOperation,
  ServerDataStore,
} from 'apollo-common'

interface SerializedGetAssembliesOperation extends SerializedOperation {
  typeName: 'GetAssembliesOperation'
}

export class GetAssembliesOperation extends Operation {
  typeName = 'GetAssembliesOperation' as const

  toJSON(): SerializedGetAssembliesOperation {
    const { typeName } = this
    return { typeName }
  }

  executeOnServer(backend: ServerDataStore) {
    return backend.assemblyModel.find({ status: 0 }).exec()
  }

  async executeOnLocalGFF3(_backend: LocalGFF3DataStore) {
    throw new Error('executeOnLocalGFF3 not implemented')
  }
}
