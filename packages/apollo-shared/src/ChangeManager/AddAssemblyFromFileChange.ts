import { join } from 'path'
import { createGunzip } from 'zlib'

import { RefSeqDocument } from 'apollo-schemas'

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
    const {
      assemblyModel,
      refSeqModel,
      refSeqChunkModel,
      fileModel,
      fs,
      session,
    } = backend
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
      const { CHUNK_SIZE } = process.env
      const chunkSize = Number(CHUNK_SIZE)
      let chunkIndex = 0
      let refSeqLen = 0
      let refSeqDoc: RefSeqDocument | undefined = undefined
      let fastaInfoStarted = fileDoc.type !== 'text/x-gff3'

      // Read data from compressed file and parse the content
      const sequenceStream = fs
        .createReadStream(compressedFullFileName)
        .pipe(createGunzip())
      let sequenceBuffer = ''
      let incompleteLine = ''
      let lastLineIsIncomplete = true
      for await (const data of sequenceStream) {
        const chunk = data.toString()
        lastLineIsIncomplete = !chunk.endsWith('\n')
        // chunk is small enough that you can split the whole thing into lines without having to make it into smaller chunks first.
        const lines = chunk.split(/\r?\n/)
        if (incompleteLine) {
          lines[0] = `${incompleteLine}${lines[0]}`
          incompleteLine = ''
        }
        if (lastLineIsIncomplete) {
          incompleteLine = lines.pop() || ''
        }
        for await (const line of lines) {
          // In case of GFF3 file we start to read sequence after '##FASTA' is found
          if (!fastaInfoStarted) {
            if (line.trim() === '##FASTA') {
              fastaInfoStarted = true
            }
            continue
          }
          const refSeqInfoLine = /^>\s*(\S+)\s*(.*)/.exec(line)
          // Add new ref sequence infor if we are reference seq info line
          if (refSeqInfoLine) {
            this.logger.debug?.(
              `Reference sequence information line "${refSeqInfoLine}"`,
            )

            // If there is sequence from previous reference sequence then we need to add it to previous ref seq
            if (sequenceBuffer !== '') {
              if (!refSeqDoc) {
                throw new Error('No refSeq document found')
              }
              refSeqLen += sequenceBuffer.length
              this.logger.debug?.(
                `*** Add the last chunk of previous ref seq ("${refSeqDoc._id}", index ${chunkIndex} and total length for ref seq is ${refSeqLen}): "${sequenceBuffer}"`,
              )
              await refSeqChunkModel.create(
                [
                  {
                    refSeq: refSeqDoc._id,
                    n: chunkIndex,
                    sequence: sequenceBuffer,
                  },
                ],
                { session },
              )
              sequenceBuffer = ''
            }
            await refSeqDoc?.updateOne({ length: refSeqLen }, { session })
            refSeqLen = 0
            chunkIndex = 0

            const name = refSeqInfoLine[1].trim()
            const description = refSeqInfoLine[2]
              ? refSeqInfoLine[2].trim()
              : ''

            const [newRefSeqDoc] = await refSeqModel.create(
              [
                {
                  name,
                  description,
                  assembly: newAssemblyDoc._id,
                  length: 0,
                  ...(CHUNK_SIZE ? { chunkSize: Number(CHUNK_SIZE) } : null),
                },
              ],
              { session },
            )
            this.logger.debug?.(
              `Added new refSeq "${name}", desc "${description}", docId "${newRefSeqDoc._id}"`,
            )
            refSeqDoc = newRefSeqDoc
          } else if (/\S/.test(line)) {
            if (!refSeqDoc) {
              throw new Error('No refSeq document found')
            }
            sequenceBuffer += line.replace(/\s/g, '')
            // If sequence block > chunk size then save chunk into Mongo
            while (sequenceBuffer.length >= chunkSize) {
              const sequence = sequenceBuffer.slice(0, chunkSize)
              refSeqLen += sequence.length
              this.logger.debug?.(
                `Add chunk (("${refSeqDoc._id}", index ${chunkIndex} and total length ${refSeqLen})): "${sequence}"`,
              )
              await refSeqChunkModel.create(
                [
                  {
                    refSeq: refSeqDoc._id,
                    n: chunkIndex,
                    sequence,
                  },
                ],
                { session },
              )
              chunkIndex++
              // Set remaining sequence
              sequenceBuffer = sequenceBuffer.slice(chunkSize)
              this.logger.debug?.(`Remaining sequence: "${sequenceBuffer}"`)
            }
          }
        }
      }

      if (sequenceBuffer || lastLineIsIncomplete) {
        if (!refSeqDoc) {
          throw new Error('No refSeq document found')
        }
        // If the file did not end with line break so the last line is incomplete
        if (lastLineIsIncomplete) {
          sequenceBuffer += incompleteLine
        }
        refSeqLen += sequenceBuffer.length
        this.logger.debug?.(
          `*** Add the very last chunk to ref seq ("${refSeqDoc._id}", index ${chunkIndex} and total length for ref seq is ${refSeqLen}): "${sequenceBuffer}"`,
        )
        await refSeqChunkModel.create(
          [
            {
              refSeq: refSeqDoc._id,
              n: chunkIndex,
              sequence: sequenceBuffer,
            },
          ],
          { session },
        )
        await refSeqDoc.updateOne({ length: refSeqLen }, { session })
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
