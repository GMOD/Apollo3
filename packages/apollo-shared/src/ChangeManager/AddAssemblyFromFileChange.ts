import { join } from 'path'
import { createGunzip } from 'zlib'

import gff, { GFF3Sequence } from '@gmod/gff'

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
    const { assemblyModel, refSeqModel, refSeqChunkModel, fs, session } =
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

      // Read data from compressed file and parse the content

      const sequenceStream = fs
        .createReadStream(compressedFullFileName)
        .pipe(createGunzip())
        .pipe(
          gff.parseStream({
            parseSequences: true,
            parseComments: false,
            parseDirectives: false,
            parseFeatures: false,
          }),
        )
      for await (const s of sequenceStream) {
        const sequence = s as GFF3Sequence
        this.logger.debug?.(
          `RefSeq: "${sequence.id}", length: ${sequence.sequence.length}`,
        )
        this.logger.debug?.(`RefSeq: "${sequence.id}"`)
        const refSeqDoc = await refSeqModel
          .findOne({ assembly: newAssemblyDoc._id, name: sequence.id })
          .session(session)
          .exec()
        if (refSeqDoc) {
          throw new Error(
            `RefSeq "${sequence.id}" already exists in assemblyId "${newAssemblyDoc._id}"`,
          )
        }
        // Add refSeq
        const { CHUNK_SIZE } = process.env
        const [newRefSeqDoc] = await refSeqModel.create(
          [
            {
              name: sequence.id,
              description: sequence.id,
              assembly: newAssemblyDoc._id,
              length: sequence.sequence.length,
              ...(CHUNK_SIZE ? { chunkSize: Number(CHUNK_SIZE) } : null),
            },
          ],
          { session },
        )
        this.logger.debug?.(
          `Added new refSeq "${sequence.id}", docId "${newRefSeqDoc._id}"`,
        )

        const { chunkSize } = newRefSeqDoc
        const numChunks = Math.ceil(sequence.sequence.length / chunkSize)
        for (let chunkNum = 0; chunkNum < numChunks; chunkNum++) {
          const start = chunkNum * chunkSize
          const chunk = sequence.sequence.slice(start, start + chunkSize)
          await refSeqChunkModel.create(
            [
              {
                refSeq: newRefSeqDoc._id,
                n: chunkNum,
                sequence: chunk,
                chunkSize,
              },
            ],
            { session },
          )
        }
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
    return new AddAssemblyFromFileChange(
      { changedIds, typeName, changes, assemblyId },
      { logger: this.logger },
    )
  }
}
