import { join } from 'path'
import { createGunzip } from 'zlib'

import gff, { GFF3Sequence } from '@gmod/gff'
import { RefSeqChunkDocument, RefSeqDocument } from 'apollo-schemas'
import { string } from 'mobx-state-tree/dist/internal'
import { Model } from 'mongoose'

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
      let refSeqDocId = ''
      let fastaInfoStarted = true
      if (fileDoc.type === 'text/x-gff3') {
        fastaInfoStarted = false
      }

      // Read data from compressed file and parse the content
      const sequenceStream = fs
        // .createReadStream(compressedFullFileName)
        .createReadStream(compressedFullFileName, { highWaterMark: 12 })
        .pipe(createGunzip())
      let chunkSequenceBlock = ''
      let refSeqDescSplitted = false
      const refSeqIdSplitted = false
      let previousOneLine = ''
      let refSeqId = ''
      let refSeqDesc = ''
      for await (const data of sequenceStream) {
        const chunk = data.toString()
        // chunk is small enough that you can split the whole thing into lines without having to make it into smaller chunks first.
        const lines = chunk.split(/\r?\n/)
        let lineIndex = 0
        for await (const oneLine of lines) {
          lineIndex++
          // In case of GFF3 file we start to read sequence after '##FASTA' is found
          if (!fastaInfoStarted && oneLine.trim() === '##FASTA') {
            fastaInfoStarted = true
            continue
          }
          // Due to stream chunks, it may happen that "##FASTA" string is splitted into 2 chunks
          if (
            previousOneLine !== '' &&
            (previousOneLine += oneLine).trim() === '##FASTA'
          ) {
            this.logger.debug?.(
              `"##FASTA" string was splitted into two chunks. Whole string is now "${previousOneLine}"`,
            )
            fastaInfoStarted = true
            previousOneLine = ''
            continue
          }
          // We need to save this line because the line may continue in next chunks to contain whole '###FASTA' string
          if (oneLine.charAt(0) === '#') {
            this.logger.debug?.(
              `LINE STARTED WITH '#' : "${oneLine}". "##FASTA" string may be splitted into two chunks`,
            )
            previousOneLine = oneLine
          } else {
            previousOneLine = ''
          }
          if (!fastaInfoStarted) {
            continue
          }

          // await new Promise((resolve) => setTimeout(resolve, 2000))

          const refSeqInfoStarted = /^>\s*(\S+)\s*(.*)/.exec(oneLine)
          // Let's check if we are processing starting line of reference seq info OR remaining part of previous starting of ref seq info line
          // i.e. it may happen that for example ref seq info ">ctgA the main contig that has description" will be split into 2 chunks
          if (refSeqInfoStarted || refSeqDescSplitted || refSeqIdSplitted) {
            this.logger.debug?.(
              `*** RefSeqInfoStarted "${refSeqInfoStarted}", refSeqIdSplitted "${refSeqIdSplitted}", refSeqDescSplitted "${refSeqDescSplitted}"`,
            )

            // If there is sequence from previous reference sequence then we need to add it to previous ref seq
            if (chunkSequenceBlock !== '') {
              refSeqLen += chunkSequenceBlock.length
              this.logger.debug?.(
                `*** Add the last chunk of previous ref seq ("${refSeqDocId}", index ${chunkIndex} and total length for ref seq is ${refSeqLen}): "${chunkSequenceBlock}"`,
              )
              await refSeqChunkModel.create(
                [
                  {
                    refSeq: refSeqDocId,
                    n: chunkIndex,
                    sequence: chunkSequenceBlock,
                  },
                ],
                { session },
              )
              let totalLen = 0
              for await (const doc of refSeqChunkModel
                .find({ refSeq: refSeqDocId })
                .session(session)) {
                this.logger.debug?.(
                  `Chunk ${doc.n}, the length is ${doc.sequence.length}`,
                )
                totalLen += doc.sequence.length
              }
              this.logger.debug?.(`Total length is ${totalLen}`)
              await refSeqModel.updateOne(
                { _id: refSeqDocId },
                { length: totalLen },
                { session },
              )

              chunkSequenceBlock = ''
              refSeqLen = 0
              chunkIndex = 0
            }

            // If previous chunk included the start of ref seq info but not whole line. Now we need to append the 1st line of this chunk to it before we add it into database
            if ((refSeqDescSplitted || refSeqIdSplitted) && lineIndex === 1) {
              // If the previous chunk ref seq description was cut
              if (refSeqDescSplitted) {
                refSeqDesc += oneLine
              }
              // If the previous chunk ref seq id was cut
              if (refSeqIdSplitted) {
                const tmp = oneLine.split(/' '(.*)/s)
                refSeqId += tmp[0].trim()
                // eslint-disable-next-line prefer-destructuring
                refSeqDesc = tmp[1]
              }
              const [newRefSeqDoc] = await refSeqModel.create(
                [
                  {
                    name: refSeqId.trim(),
                    description: refSeqDesc.trim(),
                    assembly: newAssemblyDoc._id,
                    length: 0,
                    ...(CHUNK_SIZE ? { chunkSize: Number(CHUNK_SIZE) } : null),
                  },
                ],
                { session },
              )
              this.logger.debug?.(
                `Added new refSeq "${refSeqId}", desc "${refSeqDesc}", docId "${newRefSeqDoc._id}"`,
              )
              refSeqDocId = newRefSeqDoc._id
              refSeqDescSplitted = false
              refSeqId = ''
              refSeqDesc = ''
            }

            if (refSeqInfoStarted) {
              refSeqId = refSeqInfoStarted[1].trim()
              if (refSeqInfoStarted[2]) {
                refSeqDesc = refSeqInfoStarted[2].trim()
              }
              this.logger.debug?.(
                `*** Starting to process new ref seq "${refSeqId}", desc "${refSeqDesc}", assemblyId "${newAssemblyDoc._id}"`,
              )

              // Check if current line is not the last line in the chunk (i.e. then the whole description is included in this line)
              if (lineIndex < lines.length) {
                const [newRefSeqDoc] = await refSeqModel.create(
                  [
                    {
                      name: refSeqId.trim(),
                      description: refSeqDesc.trim(),
                      assembly: newAssemblyDoc._id,
                      length: 0,
                      ...(CHUNK_SIZE
                        ? { chunkSize: Number(CHUNK_SIZE) }
                        : null),
                    },
                  ],
                  { session },
                )
                this.logger.debug?.(
                  `Added new refSeq "${refSeqId}", desc "${refSeqDesc}", docId "${newRefSeqDoc._id}"`,
                )
                refSeqDocId = newRefSeqDoc._id
                refSeqDescSplitted = false
                refSeqId = ''
                refSeqDesc = ''
              } else {
                this.logger.debug?.(
                  `*** Ref seq information is splitted into two chunks`,
                )
                refSeqDescSplitted = true
              }
            }
          } else if (/\S/.test(oneLine)) {
            chunkSequenceBlock += oneLine.replace(/\s/g, '')
            // If sequence block > chunk size then save chunk into Mongo
            while (chunkSequenceBlock.length >= chunkSize) {
              const wholeChunk = chunkSequenceBlock.slice(0, chunkSize)
              refSeqLen += wholeChunk.length
              this.logger.debug?.(
                `*** Add chunk (("${refSeqDocId}", index ${chunkIndex} and total length ${refSeqLen})): "${wholeChunk}"`,
              )
              await refSeqChunkModel.create(
                [
                  {
                    refSeq: refSeqDocId,
                    n: chunkIndex,
                    sequence: wholeChunk,
                  },
                ],
                { session },
              )
              chunkIndex++
              // Set remaining sequence
              chunkSequenceBlock = chunkSequenceBlock.slice(chunkSize)
              this.logger.debug?.(`Remaining sequence: "${chunkSequenceBlock}"`)
            }
          }
        }
      }

      if (chunkSequenceBlock.length > 0) {
        refSeqLen += chunkSequenceBlock.length
        this.logger.debug?.(
          `*** Add the very last chunk to ref seq ("${refSeqDocId}", index ${chunkIndex} and total length for ref seq is ${refSeqLen}): "${chunkSequenceBlock}"`,
        )
        await refSeqChunkModel.create(
          [
            {
              refSeq: refSeqDocId,
              n: chunkIndex,
              sequence: chunkSequenceBlock,
            },
          ],
          { session },
        )
        let totalLen = 0
        for await (const doc of refSeqChunkModel
          .find({ refSeq: refSeqDocId })
          .session(session)) {
          this.logger.debug?.(
            `Chunk ${doc.n}, the length is ${doc.sequence.length}`,
          )
          totalLen += doc.sequence.length
        }
        this.logger.debug?.(`Total length is ${totalLen}`)
        await refSeqModel.updateOne(
          { _id: refSeqDocId },
          { length: totalLen },
          { session },
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
    return new AddAssemblyFromFileChange(
      { changedIds, typeName, changes, assemblyId },
      { logger: this.logger },
    )
  }
}
