import {
    LocalGFF3DataStore,
    Operation,
    SerializedOperation,
    ServerDataStore,
  } from './abstract'
  
  interface SerializedGetAssembliesOperation extends SerializedOperation {
    typeName: 'GetAssembliesOperation'
  }
  
  export class GetAssembliesOperation extends Operation {
    typeName = 'GetAssembliesOperation' as const
  
    toJSON(): SerializedGetAssembliesOperation {
      const { typeName } = this
      return { typeName }
    }
  
    async executeOnServer(backend: ServerDataStore) {
        console.log('*** GetAssembliesOperation : executeOnServer')
        return backend.assemblyModel.find({ status: 0 }).exec()
    }
  
    async executeOnLocalGFF3(backend: LocalGFF3DataStore) {
      throw new Error('executeOnLocalGFF3 not implemented')
    }
  }

  export * from './GetAssembliesOperation'
