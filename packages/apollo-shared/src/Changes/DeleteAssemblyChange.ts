/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/require-await */
/* eslint-disable @typescript-eslint/no-unnecessary-condition */
/* eslint-disable @typescript-eslint/no-unsafe-call */
import {
  AssemblySpecificChange,
  Change,
  ClientDataStore,
  LocalGFF3DataStore,
  SerializedAssemblySpecificChange,
  ServerDataStore,
} from '@apollo-annotation/common'
import { getSession } from '@jbrowse/core/util'

export interface SerializedDeleteAssemblyChange
  extends SerializedAssemblySpecificChange {
  typeName: 'DeleteAssemblyChange'
}
export class DeleteAssemblyChange extends AssemblySpecificChange {
  typeName = 'DeleteAssemblyChange' as const

  get notification(): string {
    return `Assembly "${this.assembly}" deleted successfully.`
  }

  toJSON(): SerializedDeleteAssemblyChange {
    const { assembly, typeName } = this
    return { typeName, assembly }
  }

  getChanges(): Change[] {
    throw new Error('Method not implemented.')
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
      refSeqChunkModel,
      refSeqModel,
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

    logger.debug?.(`Assembly "${assembly}" deleted from database.`)
  }

  async executeOnLocalGFF3(_backend: LocalGFF3DataStore) {
    throw new Error('executeOnLocalGFF3 not implemented')
  }

  async executeOnClient(dataStore: ClientDataStore) {
    const { assembly } = this
    if (!dataStore) {
      throw new Error('No data store')
    }
    const session = getSession(dataStore)
    // If assemblyId is not present in client data store
    if (dataStore.assemblies.has(assembly)) {
      dataStore.deleteAssembly(assembly)
    }
    await session.removeAssembly?.(assembly)
    // @ts-expect-error this isn't on the AbstractSessionModel
    await session.removeSessionAssembly?.(assembly)
  }

  getInverse() {
    const { assembly, logger } = this
    return new DeleteAssemblyChange(
      { typeName: 'DeleteAssemblyChange', assembly },
      { logger },
    )
  }
}
