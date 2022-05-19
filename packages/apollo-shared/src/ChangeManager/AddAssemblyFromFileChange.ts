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
      // const [newAssemblyDoc] = await assemblyModel.create(   // *** IF USING THIS THEN NEWLY CREATED ASSEMBLY DOC ID IS NOT AVAILABLE WHEN ADDING REFSEQ DOCS ---> 'ID NOT EXISTS ERROR'
      //   [{ _id: assemblyId, name: assemblyName }],
      //   { session },
      // )
      const newAssemblyDoc = await assemblyModel.create({
        _id: assemblyId,
        name: assemblyName,
      })
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
        .createReadStream(compressedFullFileName)
        .pipe(createGunzip())
      let chunkSequenceBlock = ''
      for await (const data of sequenceStream) {
        const chunk = data.toString()

        // chunk is small enough that you can split the whole thing into lines without having to make it into smaller chunks first.
        const lines = chunk.split(/\r?\n/)
        for await (const oneLine of lines) {
          // this.logger.debug?.(`${oneLine.trim()}`)
          // In case of GFF3 file we start to read after '##FASTA' is found
          if (!fastaInfoStarted && oneLine.trim() === '##FASTA') {
            fastaInfoStarted = true
            continue
          }
          if (!fastaInfoStarted) {
            continue
          }

          // this.logger.debug?.(`Line:\n"${oneLine}"`)
          const defMatch = /^>\s*(\S+)\s*(.*)/.exec(oneLine)
          // Let's check if we are processing reference seq info
          if (defMatch) {
            let refSeqDesc = ''
            if (defMatch[2]) {
              refSeqDesc = defMatch[2].trim()
            }
            // If there is sequence from previous reference sequence then we need to add it to previous ref seq
            if (chunkSequenceBlock !== '') {
              refSeqLen += chunkSequenceBlock.length
              this.logger.debug?.(
                `*** Add the last chunk of previous ref seq ("${refSeqDocId}", index ${chunkIndex} and total length for ref seq is ${refSeqLen}): "${chunkSequenceBlock}"`,
              )
              await refSeqChunkModel.create({
                refSeq: refSeqDocId,
                n: chunkIndex,
                sequence: chunkSequenceBlock,
              })
              chunkSequenceBlock = ''
              refSeqLen = 0
              chunkIndex = 0
            }
            this.logger.debug?.(
              `*** Add new ref seq "${defMatch[1]}", desc "${refSeqDesc}", assemblyId "${newAssemblyDoc._id}"`,
            )
            const newRefSeqDoc = await refSeqModel.create({
              name: defMatch[1],
              description: refSeqDesc,
              assembly: newAssemblyDoc._id,
              length: 0,
              ...(CHUNK_SIZE ? { chunkSize: Number(CHUNK_SIZE) } : null),
            })
            // const [newRefSeqDoc] = await refSeqModel.create(   // **** IF USING THIS THEN 'MongoServerError: Transaction 1 has been committed.'
            //   [
            //     {
            //       name: defMatch[1],
            //       description: refSeqDesc,
            //       assembly: newAssemblyDoc._id,
            //       length: 0,
            //       ...(CHUNK_SIZE ? { chunkSize: Number(CHUNK_SIZE) } : null),
            //     },
            //   ],
            //   { session },
            // )
            this.logger.debug?.(
              `Added new refSeq "${defMatch[1]}", docId "${newRefSeqDoc._id}"`,
            )
            refSeqDocId = newRefSeqDoc._id
          } else if (/\S/.test(oneLine)) {
            chunkSequenceBlock += oneLine.replace(/\s/g, '')
            // If sequence block > chunk size then save chunk into Mongo
            if (chunkSequenceBlock.length >= chunkSize) {
              const wholeChunk = chunkSequenceBlock.slice(0, chunkSize)
              refSeqLen += wholeChunk.length
              this.logger.debug?.(
                `*** Add chunk (("${refSeqDocId}", index ${chunkIndex} and total length ${refSeqLen})): "${wholeChunk}"`,
              )
              await refSeqChunkModel.create({
                refSeq: refSeqDocId,
                n: chunkIndex,
                sequence: wholeChunk,
              })
              chunkIndex++
              // Set remaining sequence
              chunkSequenceBlock = chunkSequenceBlock.slice(chunkSize)
              this.logger.debug?.(`Remaining sequence: "${chunkSequenceBlock}"`)
            }
          }
        }
        // })
      }

      if (chunkSequenceBlock.length > 0) {
        refSeqLen += chunkSequenceBlock.length
        this.logger.debug?.(
          `*** Add the very last chunk to ref seq ("${refSeqDocId}", index ${chunkIndex} and total length for ref seq is ${refSeqLen}): "${chunkSequenceBlock}"`,
        )
        await refSeqChunkModel.create({
          refSeq: refSeqDocId,
          n: chunkIndex,
          sequence: chunkSequenceBlock,
        })

        // ************** TODO: UPDATE REF SEQ LEN OF THE LAST REF SEQ *******************
      }

      // // Read data from compressed file and parse the content
      // const sequenceStream = fs
      //   .createReadStream(compressedFullFileName)
      //   .pipe(createGunzip())
      //   .pipe(
      //     gff.parseStream({
      //       parseSequences: true,
      //       parseComments: false,
      //       parseDirectives: false,
      //       parseFeatures: false,
      //     }),
      //   )
      // for await (const s of sequenceStream) {
      //   const sequence = s as GFF3Sequence
      //   this.logger.debug?.(
      //     `RefSeq: "${sequence.id}", length: ${sequence.sequence.length}`,
      //   )
      //   this.logger.debug?.(`RefSeq: "${sequence.id}"`)
      //   const refSeqDoc = await refSeqModel
      //     .findOne({ assembly: newAssemblyDoc._id, name: sequence.id })
      //     .session(session)
      //     .exec()
      //   if (refSeqDoc) {
      //     throw new Error(
      //       `RefSeq "${sequence.id}" already exists in assemblyId "${newAssemblyDoc._id}"`,
      //     )
      //   }
      //   // Add refSeq
      //   const { CHUNK_SIZE } = process.env
      //   const [newRefSeqDoc] = await refSeqModel.create(
      //     [
      //       {
      //         name: sequence.id,
      //         description: sequence.id,
      //         assembly: newAssemblyDoc._id,
      //         length: sequence.sequence.length,
      //         ...(CHUNK_SIZE ? { chunkSize: Number(CHUNK_SIZE) } : null),
      //       },
      //     ],
      //     { session },
      //   )
      //   this.logger.debug?.(
      //     `Added new refSeq "${sequence.id}", docId "${newRefSeqDoc._id}"`,
      //   )

      //   const { chunkSize } = newRefSeqDoc
      //   const numChunks = Math.ceil(sequence.sequence.length / chunkSize)
      //   for (let chunkNum = 0; chunkNum < numChunks; chunkNum++) {
      //     const start = chunkNum * chunkSize
      //     const chunk = sequence.sequence.slice(start, start + chunkSize)
      //     await refSeqChunkModel.create(
      //       [
      //         {
      //           refSeq: newRefSeqDoc._id,
      //           n: chunkNum,
      //           sequence: chunk,
      //           chunkSize,
      //         },
      //       ],
      //       { session },
      //     )
      //   }
      // }
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
