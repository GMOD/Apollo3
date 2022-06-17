import { join } from 'path'

import {
  ChangeOptions,
  ClientDataStore,
  LocalGFF3DataStore,
  SerializedChange,
  ServerDataStore,
} from './Change'
import { FeatureChange } from './FeatureChange'

export interface SerializedAddAssemblyFromFileChangeBase
  extends SerializedChange {
  typeName: 'AddAssemblyFromFileChange'
}

export interface AddAssemblyFromFileChangeDetails {
  assemblyName: string
  fileChecksum: string
}

export interface SerializedAddAssemblyFromFileChangeSingle
  extends SerializedAddAssemblyFromFileChangeBase,
    AddAssemblyFromFileChangeDetails {}

export interface SerializedAddAssemblyFromFileChangeMultiple
  extends SerializedAddAssemblyFromFileChangeBase {
  changes: AddAssemblyFromFileChangeDetails[]
}

export type SerializedAddAssemblyFromFileChange =
  | SerializedAddAssemblyFromFileChangeSingle
  | SerializedAddAssemblyFromFileChangeMultiple

export class AddAssemblyFromFileChange extends FeatureChange {
  typeName = 'AddAssemblyFromFileChange' as const
  changes: AddAssemblyFromFileChangeDetails[]

  constructor(
    json: SerializedAddAssemblyFromFileChange,
    options?: ChangeOptions,
  ) {
    super(json, options)
    this.changes = 'changes' in json ? json.changes : [json]
  }

  toJSON() {
    if (this.changes.length === 1) {
      const [{ fileChecksum }] = this.changes
      return {
        typeName: this.typeName,
        changedIds: this.changedIds,
        assemblyId: this.assemblyId,
        fileChecksum,
      }
    }
    return {
      typeName: this.typeName,
      changedIds: this.changedIds,
      assemblyId: this.assemblyId,
      changes: this.changes,
    }
  }

  /**
   * Applies the required change to database
   * @param backend - parameters from backend
   * @returns
   */
  async applyToServer(backend: ServerDataStore) {
    const { assemblyModel, fileModel, session } = backend
    const { changes, assemblyId } = this

    for (const change of changes) {
      const { fileChecksum, assemblyName } = change
      this.logger.debug?.(`File checksum: '${fileChecksum}'`)

      const { FILE_UPLOAD_FOLDER } = process.env
      if (!FILE_UPLOAD_FOLDER) {
        throw new Error('No FILE_UPLOAD_FOLDER found in .env file')
      }
      const compressedFullFileName = join(FILE_UPLOAD_FOLDER, fileChecksum)

      // Check and add new assembly
      const assemblyDoc = await assemblyModel
        .findOne({ name: assemblyName })
        .session(session)
        .exec()
      if (assemblyDoc) {
        throw new Error(`Assembly "${assemblyName}" already exists`)
      }
      // Add assembly
      const [newAssemblyDoc] = await assemblyModel.create(
        [{ _id: assemblyId, name: assemblyName }],
        { session },
      )
      this.logger.debug?.(
        `Added new assembly "${assemblyName}", docId "${newAssemblyDoc._id}"`,
      )
      this.logger.debug?.(`Find file document by "${fileChecksum}"`)
      // Get file type from Mongo
      const fileDoc = await fileModel
        .findOne({ checksum: fileChecksum })
        .session(session)
        .exec()
      if (!fileDoc) {
        throw new Error(`File "${fileChecksum}" information not found in Mongo`)
      }
      this.logger.debug?.(`File type: "${fileDoc.type}"`)

      // Add refSeqs
      await this.addRefSeqIntoDb(
        fileDoc.type,
        compressedFullFileName,
        newAssemblyDoc._id,
        backend,
      )
    }
  }

  async applyToLocalGFF3(backend: LocalGFF3DataStore) {
    throw new Error('applyToLocalGFF3 not implemented')
  }

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  async applyToClient(dataStore: ClientDataStore) {}

  getInverse() {
    const { changedIds, typeName, changes, assemblyId } = this
    return new AddAssemblyFromFileChange(
      { changedIds, typeName, changes, assemblyId },
      { logger: this.logger },
    )
  }
}
