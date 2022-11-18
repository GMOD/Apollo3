import { getSession } from '@jbrowse/core/util'

import {
  AssemblySpecificChange,
  SerializedAssemblySpecificChange,
} from './abstract/AssemblySpecificChange'
import {
  ClientDataStore,
  LocalGFF3DataStore,
  ServerDataStore,
} from './abstract/Change'

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
  async applyToServer(backend: ServerDataStore) {
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

    // Get RefSeqs
    const refSeqs = await refSeqModel.find({ assembly }).exec()
    const refSeqIds = refSeqs.map((refSeq) => refSeq._id)
    // this.logger.debug?.(`REF SEQ IDs: ${refSeqIds}`)

    // Get and delete RefSeqChunks
    // const refSeqChunks = await refSeqChunkModel.find({ refSeq: refSeqIds }).exec()
    // const refSeqChunkIds = refSeqChunks.map((refSeq) => refSeq._id)
    // this.logger.debug?.(`REF SEQ CHUNK IDs: ${refSeqChunkIds}`)
    await refSeqChunkModel.deleteMany({ refSeq: refSeqIds }).exec()

    // Get and delete Features
    // const features = await featureModel.find({ refSeq: refSeqIds }).exec()
    // const featureIds = features.map((refSeq) => refSeq._id)
    // this.logger.debug?.(`FEATURE IDs: ${featureIds}`)
    await featureModel.deleteMany({ refSeq: refSeqIds }).exec()

    // Delete RefSeqs and Assembly
    await refSeqModel.deleteMany({ assembly }).exec()
    await assemblyModel.findByIdAndDelete(assembly).exec()

    this.logger.debug?.(`Assembly "${assembly}" deleted from database.`)
  }

  async applyToLocalGFF3(backend: LocalGFF3DataStore) {
    throw new Error('applyToLocalGFF3 not implemented')
  }

  async applyToClient(dataStore: ClientDataStore) {
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
