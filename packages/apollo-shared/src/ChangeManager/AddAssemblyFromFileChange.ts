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
      // if (assemblyDoc) {
      //   throw new Error(`Assembly "${assemblyName}" already exists`)
      // }
      // // Add assembly
      // const [newAssemblyDoc] = await assemblyModel.create(
      //   [{ _id: assemblyId, name: assemblyName }],
      //   { session },
      // )
      // this.logger.debug?.(
      //   `Added new assembly "${assemblyName}", docId "${newAssemblyDoc._id}"`,
      // )

      const { CHUNK_SIZE } = process.env
      const chunkSize = Number(CHUNK_SIZE)

      // Read data from compressed file and parse the content
      const sequenceStream = fs
        .createReadStream(compressedFullFileName)
        .pipe(createGunzip())

      for await (const data of sequenceStream) {
        const chunk = data.toString()
        // this.logger.debug?.(`Chunk: "${chunk}, kpl: ${Math.ceil(chunk.length / chunkSize)}"`)
        this.logger.debug?.(`${chunk.length}, ${chunkSize}"`)

        const numChunks = Math.ceil(chunk.length / chunkSize)
        let refSeqInfoChars = 0 // this indicates how many chars are used for reference sequnece information. i.e. these chars will not be included in sequence chunks
        for (let chunkNum = 0; chunkNum < numChunks; chunkNum++) {
          const start = chunkNum * chunkSize + refSeqInfoChars
          const oneChunk = chunk.slice(start, start + chunkSize)

          this.logger.debug?.(
            `Luku alkoi positiosta ${start} ja chunk on : "${oneChunk}"`,
          )
          // const linesInChunkArray = chunk.match(/[^\r\n]+/g)
          // for (const oneLine of linesInChunkArray) {
          // this.logger.debug?.(`ONE LINE: "${oneLine}"`)
          // const defMatch = /^>\s*(\S+)\s*(.*)/.exec(oneChunk)
          const defMatch = />\s*(\S+)\s*(.*)/.exec(oneChunk)
          if (defMatch) {
            // *** TODO: If matched then we need to read the whole line, otherwise refseq description may not be complete ***
            // *** TODO: If chunk does not start with '>' but it's in middle of chunk, then the beginning of chunk is previous ref seq sequence 
            let refSeqDesc = ''
            this.logger.debug?.(`MATCHED: "${defMatch[1]}"`)
            if (defMatch[2]) {
              this.logger.debug?.(
                `MATCHED SEQUENCE DESCRIPTION: "${defMatch[2]}"`,
              )
              refSeqDesc = defMatch[2].trim()
            }
            const splitted = chunk.match(/[^\r\n]+/g)
            this.logger.debug?.(
              `splitted eka arvon pituus: "${splitted[0]}", "${splitted[0].length}"`,
            )
            refSeqInfoChars += splitted[0].length
            const twoChunk = chunk.slice(
              start + splitted[0].length,
              start + chunkSize + splitted[0].length,
            )
            this.logger.debug?.(`Two chunk: "${twoChunk.replace(/\s/g, '')}"`)
            // Add new reference sequence into database
            // } else if (this.currentSequence && /\S/.test(chunk)) {
          } else if (/\S/.test(oneChunk)) {
            // this.currentSequence.sequence += chunk.replace(/\s/g, '')
            this.logger.debug?.(`SEQUENCE : "${oneChunk.replace(/\s/g, '')}"`)
            // this.currentSequence.sequence += chunk.replace(/\s/g, '')
          } else {
            this.logger.debug?.(` *********** IHAN JOTAIN MUUTA ************"`)
          }
          // }

          //   const defMatch = /^>\s*(\S+)\s*(.*)/.exec(oneChunk)
          // if (defMatch) {
          //   let refSeqDesc = ''
          //   this.logger.debug?.(`MATCHED: "${defMatch[1]}"`)
          //   if (defMatch[2]) {
          //     this.logger.debug?.(
          //       `MATCHED SEQUENCE DESCRIPTION: "${defMatch[2]}"`,
          //     )
          //     refSeqDesc = defMatch[2].trim()
          //   }
          //   const splitted = chunk.match(/[^\r\n]+/g)
          // this.logger.debug?.(`splitted eka arvon pituus: "${splitted[0]}", "${splitted[0].length}"`)
          // refSeqInfoChars += splitted[0].length
          // const twoChunk = chunk.slice(start + splitted[0].length, start + chunkSize + splitted[0].length)
          // this.logger.debug?.(`Two chunk: "${twoChunk.replace(/\s/g, '')}"`)
          //   // Add new reference sequence into database
          //   // } else if (this.currentSequence && /\S/.test(chunk)) {
          // } else if (/\S/.test(oneChunk)) {
          //   // this.currentSequence.sequence += chunk.replace(/\s/g, '')
          //   this.logger.debug?.(`SEQUENCE : "${oneChunk.replace(/\s/g, '')}"`)
          //   // this.currentSequence.sequence += chunk.replace(/\s/g, '')
          // } else {
          //   this.logger.debug?.(` *********** IHAN JOTAIN MUUTA ************"`)
          // }
        }

        // const refSeqDoc = await refSeqModel
        //   .findOne({ assembly: newAssemblyDoc._id, name: sequence.id })
        //   .session(session)
        //   .exec()
        // if (refSeqDoc) {
        //   throw new Error(
        //     `RefSeq "${sequence.id}" already exists in assemblyId "${newAssemblyDoc._id}"`,
        //   )
        // }
        // // Add refSeq
        // const { CHUNK_SIZE } = process.env
        // const [newRefSeqDoc] = await refSeqModel.create(
        //   [
        //     {
        //       name: sequence.id,
        //       description: sequence.id,
        //       assembly: newAssemblyDoc._id,
        //       length: sequence.sequence.length,
        //       ...(CHUNK_SIZE ? { chunkSize: Number(CHUNK_SIZE) } : null),
        //     },
        //   ],
        //   { session },
        // )
        // this.logger.debug?.(
        //   `Added new refSeq "${sequence.id}", docId "${newRefSeqDoc._id}"`,
        // )

        // const { chunkSize } = newRefSeqDoc
        // const numChunks = Math.ceil(sequence.sequence.length / chunkSize)
        // for (let chunkNum = 0; chunkNum < numChunks; chunkNum++) {
        //   const start = chunkNum * chunkSize
        //   const chunk = sequence.sequence.slice(start, start + chunkSize)
        //   await refSeqChunkModel.create(
        //     [
        //       {
        //         refSeq: newRefSeqDoc._id,
        //         n: chunkNum,
        //         sequence: chunk,
        //         chunkSize,
        //       },
        //     ],
        //     { session },
        //   )
        // }
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
