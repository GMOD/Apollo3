import { getSession } from '@jbrowse/core/util'

import { AssemblySpecificChange } from './abstract/AssemblySpecificChange'
import {
  ChangeOptions,
  ClientDataStore,
  LocalGFF3DataStore,
  SerializedChange,
  ServerDataStore,
} from './abstract/Change'
import { DeleteFeatureChangeDetails } from './DeleteFeatureChange'
import { FeatureChange } from './FeatureChange'

interface SerializedDeleteAssemblyBase extends SerializedChange {
  changes: DeleteAssemblyDetails
  typeName: 'DeleteAssemblyChange'
}

export interface DeleteAssemblyDetails {
  parentFeatureId?: string // Parent feature to where feature will be added
}

export class DeleteAssemblyChange extends AssemblySpecificChange {
  typeName = 'DeleteAssemblyChange' as const
  changes: DeleteAssemblyDetails

  constructor(json: SerializedDeleteAssemblyBase, options?: ChangeOptions) {
    super(json, options)
    this.changes = json.changes
  }

  toJSON(): SerializedDeleteAssemblyBase {
    const { changes, typeName, assembly } = this
    return { changes, typeName, assembly }
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
    const { assembly } = this

    const assembly = await assemblyModel
      .findById(assembly)
      .session(session)
      .exec()
    if (!assembly) {
      const errMsg = `*** ERROR: Assembly with id "${assembly}" not found`
      logger.error(errMsg)
      throw new Error(errMsg)
    }

    // Get RefSeqs
    const refSeqs = await refSeqModel.find({ assembly: assemblyId }).exec()
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
    await refSeqModel.deleteMany({ assembly: assemblyId }).exec()
    await assemblyModel.deleteOne({ _id: assemblyId }).exec()

    this.logger.debug?.(`Assembly "${assemblyId}" deleted from database.`)
  }

  async applyToLocalGFF3(backend: LocalGFF3DataStore) {
    throw new Error('applyToLocalGFF3 not implemented')
  }

  async applyToClient(dataStore: ClientDataStore) {
    if (!dataStore) {
      throw new Error('No data store')
    }
    const session = getSession(dataStore)
    // If assemblyId is not present in client data store
    if (!dataStore.assemblies.has(this.assemblyId)) {
      await session.removeAssembly?.(this.assemblyId)
      // eslint-disable-next-line no-console
      console.log('Assembly has been deleted from session!')
      return
    }
    dataStore.deleteAssembly(this.assemblyId)
    await session.removeAssembly?.(this.assemblyId)
    // eslint-disable-next-line no-console
    console.log('Assembly has been deleted from session and client data store')
  }

  getInverse() {
    return new DeleteAssemblyChange({
      typeName: 'DeleteAssemblyChange',
      assembly: '123',
      changes: {},
    })
  }
}

export function isDeleteAssembly(
  change: unknown,
): change is DeleteAssemblyChange {
  return (change as DeleteAssemblyChange).typeName === 'DeleteAssemblyChange'
}
