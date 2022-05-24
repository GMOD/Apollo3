import { join } from 'path'
import { createGunzip } from 'zlib'

import gff, { GFF3Feature } from '@gmod/gff'

import {
  Change,
  ChangeOptions,
  ClientDataStore,
  LocalGFF3DataStore,
  SerializedChange,
  ServerDataStore,
} from './Change'
import { addFeatureIntoDb } from './Common'

export interface SerializedAddAssemblyAndFeaturesFromFileChangeBase
  extends SerializedChange {
  typeName: 'AddAssemblyAndFeaturesFromFileChange'
}

export interface AddAssemblyAndFeaturesFromFileChangeDetails {
  assemblyName: string
  fileChecksum: string
}

export interface SerializedAddAssemblyAndFeaturesFromFileChangeSingle
  extends SerializedAddAssemblyAndFeaturesFromFileChangeBase,
    AddAssemblyAndFeaturesFromFileChangeDetails {}

export interface SerializedAddAssemblyAndFeaturesFromFileChangeMultiple
  extends SerializedAddAssemblyAndFeaturesFromFileChangeBase {
  changes: AddAssemblyAndFeaturesFromFileChangeDetails[]
}

export type SerializedAddAssemblyAndFeaturesFromFileChange =
  | SerializedAddAssemblyAndFeaturesFromFileChangeSingle
  | SerializedAddAssemblyAndFeaturesFromFileChangeMultiple

export class AddAssemblyAndFeaturesFromFileChange extends Change {
  typeName = 'AddAssemblyAndFeaturesFromFileChange' as const
  changes: AddAssemblyAndFeaturesFromFileChangeDetails[]

  constructor(
    json: SerializedAddAssemblyAndFeaturesFromFileChange,
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
    const { assemblyModel, refSeqModel, featureModel, fileModel, fs, session } =
      backend
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
      // Read data from compressed file and parse the content
      const featureStream = fs
        .createReadStream(compressedFullFileName)
        .pipe(createGunzip())
        .pipe(
          gff.parseStream({
            parseSequences: false,
            parseComments: false,
            parseDirectives: false,
            parseFeatures: true,
          }),
        )
      for await (const f of featureStream) {
        const gff3Feature = f as GFF3Feature
        this.logger.verbose?.(`ENTRY=${JSON.stringify(gff3Feature)}`)

        // Add new feature into database
        await addFeatureIntoDb(
          gff3Feature,
          session,
          featureModel,
          refSeqModel,
          assemblyId,
          this.logger,
        )
      }
    }
  }

  async applyToLocalGFF3(backend: LocalGFF3DataStore) {
    throw new Error('applyToLocalGFF3 not implemented')
  }

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  async applyToClient(dataStore: ClientDataStore) {}

  getInverse() {
    const { changedIds, typeName, changes, assemblyId } = this
    return new AddAssemblyAndFeaturesFromFileChange(
      { changedIds, typeName, changes, assemblyId },
      { logger: this.logger },
    )
  }
}
