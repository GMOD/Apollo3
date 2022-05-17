import { join } from 'path'
import { createGunzip } from 'zlib'

import gff from '@gmod/gff'

import {
  Change,
  ChangeOptions,
  ClientDataStore,
  LocalGFF3DataStore,
  SerializedChange,
  ServerDataStore,
} from './Change'

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

export class AddAssemblyFromFileChange extends Change {
  typeName = 'AddAssemblyFromFileChange' as const
  changes: AddAssemblyFromFileChangeDetails[]

  constructor(
    json: SerializedAddAssemblyFromFileChange,
    options?: ChangeOptions,
  ) {
    super(json, options)
    this.changedIds = json.changedIds
    this.changes = 'changes' in json ? json.changes : [json]
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
    const { refSeqModel, assemblyModel, refSeqChunkModel, fs } = backend
    const { changes } = this
    const { CHUNK_LEN } = process.env
    if (!CHUNK_LEN) {
      throw new Error('No CHUNK_LEN found in .env file')
    }

    for (const change of changes) {
      const { fileChecksum, assemblyName } = change
      this.logger.debug?.(`File checksum: '${fileChecksum}'`)

      const { FILE_UPLOAD_FOLDER } = process.env
      if (!FILE_UPLOAD_FOLDER) {
        throw new Error('No FILE_UPLOAD_FOLDER found in .env file')
      }
      const compressedFullFileName = join(FILE_UPLOAD_FOLDER, `${fileChecksum}`)

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
      await fs
        .createReadStream(compressedFullFileName)
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
            // Add refSeq
            const newRefSeqDoc = await refSeqModel.create({
              name: data.id,
              description: data.id,
              assembly: newAssemblyDoc._id,
              length: data.sequence.length,
            })
            this.logger.debug?.(
              `Added new refSeq "${data.id}", docId "${newRefSeqDoc._id}"`,
            )

            let ind = 0
            const chunkLength = Number(CHUNK_LEN)
            const numChunks = Math.ceil(data.sequence.length / chunkLength)
            for (let chunkNum = 0; chunkNum < numChunks - 1; chunkNum++) {
              const start = chunkNum * chunkLength
              const chunk = data.sequence.slice(start, start + chunkLength)
              const newRefSeqChunkDoc = await refSeqChunkModel.create({
                refSeq: newRefSeqDoc._id,
                n: chunkNum,
                sequence: chunk,
              })
              this.logger.debug?.(
                `Added new refSeqChunk (n=${ind}) docId "${newRefSeqChunkDoc._id}" for refSeq "${newRefSeqDoc._id}"`,
              )
              ind++
            }
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
