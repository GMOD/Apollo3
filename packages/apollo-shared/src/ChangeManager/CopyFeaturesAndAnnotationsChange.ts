import { join } from 'path'
import { createGunzip } from 'zlib'

import gff, { GFF3Feature } from '@gmod/gff'
import { Change } from 'apollo-schemas'

import {
  ChangeOptions,
  ClientDataStore,
  LocalGFF3DataStore,
  SerializedChange,
  ServerDataStore,
} from './Change'
import { FeatureChange } from './FeatureChange'

export interface SerializedCopyFeaturesAndAnnotationsChangeBase
  extends SerializedChange {
  typeName: 'CopyFeaturesAndAnnotationsChange'
}

export interface CopyFeaturesAndAnnotationsDetails {
  assemblyId: string
  targetAssemblyId: string
  featureId: string
}

export class CopyFeaturesAndAnnotationsChange extends FeatureChange {
  typeName = 'CopyFeaturesAndAnnotationsChange' as const

  constructor(json: SerializedChange, options?: ChangeOptions) {
    super(json, options)
  }

  toJSON(): SerializedCopyFeaturesAndAnnotationsChangeBase {
    return {
      typeName: this.typeName,
      changedIds: this.changedIds,
      assemblyId: this.assemblyId,
    }
  }

  /**
   * Applies the required change to database
   * @param backend - parameters from backend
   * @returns
   */
  async applyToServer(backend: ServerDataStore) {
    const { fs, fileModel, session } = backend
    // const { changes } = this

    // for (const change of changes) {
    //   const { fileId } = change

    //   const { FILE_UPLOAD_FOLDER } = process.env
    //   if (!FILE_UPLOAD_FOLDER) {
    //     throw new Error('No FILE_UPLOAD_FOLDER found in .env file')
    //   }
    //   // Get file checksum
    //   const fileDoc = await fileModel.findById(fileId).session(session).exec()
    //   if (!fileDoc) {
    //     throw new Error(`File "${fileId}" not found in Mongo`)
    //   }
    //   this.logger.debug?.(`FileId "${fileId}", checksum "${fileDoc.checksum}"`)
    //   const compressedFullFileName = join(FILE_UPLOAD_FOLDER, fileDoc.checksum)

    //   // Read data from compressed file and parse the content
    //   const featureStream = fs
    //     .createReadStream(compressedFullFileName)
    //     .pipe(createGunzip())
    //     .pipe(
    //       gff.parseStream({
    //         parseSequences: false,
    //         parseComments: false,
    //         parseDirectives: false,
    //         parseFeatures: true,
    //       }),
    //     )
    //   for await (const f of featureStream) {
    //     const gff3Feature = f as GFF3Feature
    //     this.logger.verbose?.(`ENTRY=${JSON.stringify(gff3Feature)}`)

    //     // Add new feature into database
    //     await this.addFeatureIntoDb(gff3Feature, backend)
    //   }
    // }
    this.logger.debug?.(`********* CopyFeaturesAndAnnotationsChange **************`)
  }

  async applyToLocalGFF3(backend: LocalGFF3DataStore) {
    throw new Error('applyToLocalGFF3 not implemented')
  }

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  async applyToClient(dataStore: ClientDataStore) {}

  getInverse() {
    const { changedIds, typeName, assemblyId } = this
    return new CopyFeaturesAndAnnotationsChange(
      { changedIds, typeName, assemblyId },
      { logger: this.logger },
    )
  }
}
