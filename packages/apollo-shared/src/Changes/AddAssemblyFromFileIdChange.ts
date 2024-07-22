/* eslint-disable @typescript-eslint/restrict-template-expressions */
/* eslint-disable @typescript-eslint/no-unnecessary-condition */

/* eslint-disable @typescript-eslint/require-await */
import {
  AssemblySpecificChange,
  ChangeOptions,
  ClientDataStore,
  LocalGFF3DataStore,
  SerializedAssemblySpecificChange,
  ServerDataStore,
} from '@apollo-annotation/common'
import { BgzipIndexedFasta, IndexedFasta } from '@gmod/indexedfasta'
import { LocalFile } from 'generic-filehandle'
import path from 'node:path'
import { LocalFileGzip } from '../util'

export interface SerializedAddAssemblyFromFileIdChangeBase
  extends SerializedAssemblySpecificChange {
  typeName: 'AddAssemblyFromFileIdChange'
}

export interface AddAssemblyFromFileIdChangeDetails {
  assemblyName: string
  fileIds: { fa: string; fai: string; gzi?: string }
}

export interface SerializedAddAssemblyFromFileIdChangeSingle
  extends SerializedAddAssemblyFromFileIdChangeBase,
    AddAssemblyFromFileIdChangeDetails {}

export interface SerializedAddAssemblyFromFileIdChangeMultiple
  extends SerializedAddAssemblyFromFileIdChangeBase {
  changes: AddAssemblyFromFileIdChangeDetails[]
}

export type SerializedAddAssemblyFromFileIdChange =
  | SerializedAddAssemblyFromFileIdChangeSingle
  | SerializedAddAssemblyFromFileIdChangeMultiple

export class AddAssemblyFromFileIdChange extends AssemblySpecificChange {
  typeName = 'AddAssemblyFromFileIdChange' as const
  changes: AddAssemblyFromFileIdChangeDetails[]

  constructor(
    json: SerializedAddAssemblyFromFileIdChange,
    options?: ChangeOptions,
  ) {
    super(json, options)
    this.changes = 'changes' in json ? json.changes : [json]
  }

  get notification(): string {
    return `Assembly "${this.changes[0].assemblyName}" added successfully. To use it, please refresh the page.`
  }

  toJSON(): SerializedAddAssemblyFromFileIdChange {
    const { assembly, changes, typeName } = this
    if (changes.length === 1) {
      const [{ assemblyName, fileIds }] = changes
      return { typeName, assembly, assemblyName, fileIds }
    }
    return { typeName, assembly, changes }
  }

  /**
   * Applies the required change to database
   * @param backend - parameters from backend
   * @returns
   */
  async executeOnServer(backend: ServerDataStore) {
    const { assemblyModel, fileModel, refSeqModel, user } = backend
    const { assembly, changes, logger } = this
    const { CHUNK_SIZE } = process.env
    const customChunkSize = CHUNK_SIZE && Number(CHUNK_SIZE)

    const { FILE_UPLOAD_FOLDER } = process.env
    if (!FILE_UPLOAD_FOLDER) {
      throw new Error('No FILE_UPLOAD_FOLDER found in .env file')
    }

    for (const change of changes) {
      const { assemblyName, fileIds } = change
      const { fa, fai, gzi } = fileIds

      const faDoc = (await fileModel.findById(fa))
      const faChecksum = faDoc?.checksum
      if (!faChecksum) {
        throw new Error(`No checksum for file document ${faDoc}`)
      }

      const faiDoc = (await fileModel.findById(fai))
      const faiChecksum = faiDoc?.checksum
      if (!faiChecksum) {
        throw new Error(`No checksum for file document ${faiDoc}`)
      }

      const gziDoc = (await fileModel.findById(gzi))
      const gziChecksum = faiDoc?.checksum
      if (!faiChecksum) {
        throw new Error(`No checksum for file document ${gziDoc}`)
      }

      const sequenceAdapter = gzi
        ? new BgzipIndexedFasta({
            fasta: new LocalFile(path.join(FILE_UPLOAD_FOLDER, faChecksum)),
            fai: new LocalFileGzip(path.join(FILE_UPLOAD_FOLDER, faiChecksum)),
            gzi: new LocalFile(path.join(FILE_UPLOAD_FOLDER, gziChecksum)),
          })
        : new IndexedFasta({
          fasta: new LocalFile(path.join(FILE_UPLOAD_FOLDER, fa)),
          fai: new LocalFileGzip(path.join(FILE_UPLOAD_FOLDER, fai)),
        })
      const allSequenceSizes = await sequenceAdapter.getSequenceSizes()

      if (!allSequenceSizes) {
        throw new Error('No data read from indexed fasta getSequenceSizes')
      }

      const assemblyDoc = await assemblyModel
        .findOne({ name: assemblyName })
        .exec()
      if (assemblyDoc) {
        throw new Error(`Assembly "${assemblyName}" already exists`)
      }
      const [newAssemblyDoc] = await assemblyModel.create([
        {
          _id: assembly,
          name: assemblyName,
          user,
          status: -1,
          fileIds,
        },
      ])
      logger.debug?.(
        `Added new assembly "${assemblyName}", docId "${newAssemblyDoc._id}"`,
      )

      for (const sequenceName in allSequenceSizes) {
        const [newRefSeqDoc] = await refSeqModel.create([
          {
            name: sequenceName,
            assembly: newAssemblyDoc._id,
            length: allSequenceSizes[sequenceName],
            ...(customChunkSize ? { chunkSize: customChunkSize } : null),
            user,
            status: -1,
          },
        ])
        logger.debug?.(
          `Added new refSeq "${sequenceName}", docId "${newRefSeqDoc._id}"`,
        )
      }
    }
  }

  async executeOnLocalGFF3(_backend: LocalGFF3DataStore) {
    throw new Error('executeOnLocalGFF3 not implemented')
  }

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  async executeOnClient(_dataStore: ClientDataStore) {}

  getInverse() {
    const { assembly, changes, logger, typeName } = this
    return new AddAssemblyFromFileIdChange(
      { typeName, changes, assembly },
      { logger },
    )
  }
}

