import { getSession } from '@jbrowse/core/util'

import {
  AssemblySpecificChange,
  ClientDataStore,
  LocalGFF3DataStore,
  SerializedAssemblySpecificChange,
  ServerDataStore,
} from './abstract'

interface SerializedDeleteAssemblyChange
  extends SerializedAssemblySpecificChange {
  typeName: 'DeleteAssemblyChange'
}
export class DeleteAssemblyChange extends AssemblySpecificChange {
  typeName = 'DeleteAssemblyChange' as const

  get notification(): string {
    return `Assembly "${this.assembly}" deleted successfully.`
  }

  toJSON(): SerializedDeleteAssemblyChange {
    const { typeName, assembly } = this
    return { typeName, assembly }
  }

  /**
   * Applies the required change to database
   * @param backend - parameters from backend
   * @returns
   */
  async executeOnServer(backend: ServerDataStore) {
    const {
      assemblyModel,
      featureModel,
      refSeqModel,
      refSeqChunkModel,
      session,
    } = backend
    const { assembly, logger } = this

    const assemblyDoc = await assemblyModel
      .findById(assembly)
      .session(session)
      .exec()
    if (!assemblyDoc) {
      const errMsg = `*** ERROR: Assembly with id "${assembly}" not found`
      logger.error(errMsg)
      throw new Error(errMsg)
    }

    // We cannot use Mongo 'session' / transaction here because Mongo has 16 MB limit for transaction

    // Get RefSeqs
    const refSeqs = await refSeqModel.find({ assembly }).exec()
    const refSeqIds = refSeqs.map((refSeq) => refSeq._id)

    // Get and delete RefSeqChunks
    await refSeqChunkModel.deleteMany({ refSeq: refSeqIds }).exec()

    // Get and delete Features
    await featureModel.deleteMany({ refSeq: refSeqIds }).exec()

    // Delete RefSeqs and Assembly
    await refSeqModel.deleteMany({ assembly }).exec()
    await assemblyModel.findByIdAndDelete(assembly).exec()

    this.logger.debug?.(`Assembly "${assembly}" deleted from database.`)
  }

  async executeOnLocalGFF3(backend: LocalGFF3DataStore) {
    throw new Error('executeOnLocalGFF3 not implemented')
  }

  async executeOnClient(dataStore: ClientDataStore) {
    const { assembly } = this
    if (!dataStore) {
      throw new Error('No data store')
    }
    const session = getSession(dataStore)
    // If assemblyId is not present in client data store
    if (!dataStore.assemblies.has(assembly)) {
      await session.removeAssembly?.(assembly)
      return
    }
    dataStore.deleteAssembly(assembly)
    await session.removeAssembly?.(assembly)
  }

  getInverse() {
    const { assembly, logger } = this
    return new DeleteAssemblyChange(
      { typeName: 'DeleteAssemblyChange', assembly },
      { logger },
    )
  }
}
