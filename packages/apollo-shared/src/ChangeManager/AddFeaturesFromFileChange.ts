import { join } from 'path'
import { createGunzip } from 'zlib'

import gff, { GFF3Feature } from '@gmod/gff'

import {
  ChangeOptions,
  ClientDataStore,
  LocalGFF3DataStore,
  SerializedChange,
  ServerDataStore,
} from './Change'
import { FeatureChange } from './FeatureChange'

export interface SerializedAddFeaturesFromFileChangeBase
  extends SerializedChange {
  typeName: 'AddFeaturesFromFileChange'
}

export interface AddFeaturesFromFileChangeDetails {
  fileId: string
}

export interface SerializedAddFeaturesFromFileChangeSingle
  extends SerializedAddFeaturesFromFileChangeBase,
    AddFeaturesFromFileChangeDetails {}

export interface SerializedAddFeaturesFromFileChangeMultiple
  extends SerializedAddFeaturesFromFileChangeBase {
  changes: AddFeaturesFromFileChangeDetails[]
}

export type SerializedAddFeaturesFromFileChange =
  | SerializedAddFeaturesFromFileChangeSingle
  | SerializedAddFeaturesFromFileChangeMultiple

export class AddFeaturesFromFileChange extends FeatureChange {
  typeName = 'AddFeaturesFromFileChange' as const
  changes: AddFeaturesFromFileChangeDetails[]

  constructor(
    json: SerializedAddFeaturesFromFileChange,
    options?: ChangeOptions,
  ) {
    super(json, options)
    this.changes = 'changes' in json ? json.changes : [json]
  }

  toJSON(): SerializedAddFeaturesFromFileChange {
    if (this.changes.length === 1) {
      const [{ fileId }] = this.changes
      return {
        typeName: this.typeName,
        changedIds: this.changedIds,
        assemblyId: this.assemblyId,
        fileId,
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
    const { fs, fileModel, session } = backend
    const { changes } = this

    for (const change of changes) {
      const { fileId } = change

      const { FILE_UPLOAD_FOLDER } = process.env
      if (!FILE_UPLOAD_FOLDER) {
        throw new Error('No FILE_UPLOAD_FOLDER found in .env file')
      }
      // Get file checksum
      const fileDoc = await fileModel.findById(fileId).session(session).exec()
      if (!fileDoc) {
        throw new Error(`File "${fileId}" not found in Mongo`)
      }
      this.logger.debug?.(`FileId "${fileId}", checksum "${fileDoc.checksum}"`)
      const compressedFullFileName = join(FILE_UPLOAD_FOLDER, fileDoc.checksum)

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
        await this.addFeatureIntoDb(gff3Feature, backend)
      }
    }
    this.logger.debug?.(`New features added into database!`)
  }

  async applyToLocalGFF3(backend: LocalGFF3DataStore) {
    throw new Error('applyToLocalGFF3 not implemented')
  }

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  async applyToClient(dataStore: ClientDataStore) {}

  getInverse() {
    const { changedIds, typeName, changes, assemblyId } = this
    return new AddFeaturesFromFileChange(
      { changedIds, typeName, changes, assemblyId },
      { logger: this.logger },
    )
  }
}
