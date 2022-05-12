import { createReadStream } from 'fs'
import { join } from 'path'
import { createGunzip } from 'zlib'

import gff, { GFF3Feature, GFF3FeatureLine } from '@gmod/gff'
import { v4 as uuidv4 } from 'uuid'

import {
  Change,
  ChangeOptions,
  ClientDataStore,
  LocalGFF3DataStore,
  SerializedChange,
  ServerDataStore,
} from './Change'

// export interface GFF3FeatureLineWithOptionalRefs extends GFF3FeatureLine {
//   // eslint-disable-next-line camelcase
//   child_features?: GFF3Feature[]
//   // eslint-disable-next-line camelcase
//   derived_features?: GFF3Feature[]
// }

export interface AssembliesFromFileChange {
  assemblyName: string
  fileChecksum: string
}

export interface SerializedAddAssemblyFromFileChange extends SerializedChange {
  typeName: 'AddAssemblyFromFileChange'
  changes: AssembliesFromFileChange[]
}

export class AddAssemblyFromFileChange extends Change {
  typeName = 'AddAssemblyFromFileChange' as const
  changes: AssembliesFromFileChange[]

  constructor(
    json: SerializedAddAssemblyFromFileChange,
    options?: ChangeOptions,
  ) {
    super(json, options)
    this.changedIds = json.changedIds
    this.changes = json.changes
  }

  toJSON() {
    return {
      changedIds: this.changedIds,
      typeName: this.typeName,
      changes: this.changes,
      assemblyId: this.assemblyId,
    }
  }

  /**
   * Applies the required change to database
   * @param backend - parameters from backend
   * @returns
   */
  async applyToServer(backend: ServerDataStore) {
    const { refSeqModel, assemblyModel } = backend
    const { changes } = this
    const { CHUNK_LEN } = process.env

    for (const change of changes) {
      const { fileChecksum, assemblyName } = change
      this.logger.debug?.(`File checksum: '${fileChecksum}'`)

      const { FILE_UPLOAD_FOLDER } = process.env
      if (!FILE_UPLOAD_FOLDER) {
        throw new Error('No FILE_UPLOAD_FOLDER found in .env file')
      }
      const compressedFullFileName = join(
        FILE_UPLOAD_FOLDER,
        `${fileChecksum}.gz`,
      )

      // Check and add new assembly
      const assemblyDoc = await assemblyModel
        .findOne({ name: assemblyName })
        .exec()
      if (assemblyDoc) {
        throw new Error(`Assembly "${assemblyName}" already exists`)
      }
      // Add assembly
      const newAssemblyDoc = await assemblyModel.create({ name: assemblyName })
      this.logger.debug?.(
        `Added new assembly "${assemblyName}", docId "${newAssemblyDoc._id}"`,
      )

      // Read data from compressed file and parse the content
      await createReadStream(compressedFullFileName)
        .pipe(createGunzip())
        .pipe(
          gff.parseStream({
            parseFeatures: false,
            parseDirectives: false,
            parseComments: false,
            parseSequences: true,
          }),
        )
        .on('data', async (data) => {
          if (data.sequence) {
            this.logger.debug?.(
              `RefSeq: "${data.id}", length: ${data.sequence.length}`,
            )
            this.logger.debug?.(`RefSeq: "${data.id}"`)
            const refSeqDoc = await refSeqModel
              .findOne({ assembly: newAssemblyDoc._id, name: data.id })
              .exec()
            if (refSeqDoc) {
              throw new Error(
                `RefSeq "${data.id}" already exists in assemblyId "${newAssemblyDoc._id}"`,
              )
            }
            // Add assembly
            const newRefSeqDoc = await refSeqModel.create({
              name: data.id,
              description: data.id,
              assembly: newAssemblyDoc._id,
              length: data.sequence.length,
            })
            this.logger.debug?.(
              `Added new refSeq "${data.id}", docId "${newRefSeqDoc._id}"`,
            )
          }
        })
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  async applyToLocalGFF3(backend: LocalGFF3DataStore) {}

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  async applyToClient(dataStore: ClientDataStore) {}

  getInverse() {
    return new AddAssemblyFromFileChange(
      {
        changedIds: this.changedIds,
        typeName: 'AddAssemblyFromFileChange',
        changes: this.changes,
        assemblyId: this.assemblyId,
      },
      { logger: this.logger },
    )
  }
}
