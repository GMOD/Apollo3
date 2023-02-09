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

  async executeOnServer(backend: ServerDataStore) {
    console.log('***** EXECUTE ON SERVER ')
    console.log(`ONTOLOGIES: ${JSON.stringify(backend)}`)
    // const a = await backend.assemblyModel.find({ status: 0 }).exec()
    // console.log(`AAAAA: ${JSON.stringify(a)}`)
    // const dummy = backend.ontologyService.dummy()
    // // const dummy = backend.ontologyService.getPossibleChildTypes('mRNA')
    // console.log(`DUMMY: ${JSON.stringify(dummy)}`)

    // return backend.ontologyService.getPossibleChildTypes('mRNA')
    const eka = await backend.counterService.getNextSequenceValue('changeCounter')
    console.log(`*** EKA: ${JSON.stringify(eka)}`)
    const teka = await backend.ontologyService.getPossibleChildTypes('mRNA')
    console.log(`*** TEKA: ${JSON.stringify(teka)}`)
    return backend.counterService.getNextSequenceValue('changeCounter')
  }

  async executeOnLocalGFF3(backend: LocalGFF3DataStore) {
    throw new Error('executeOnLocalGFF3 not implemented')
  }
}
