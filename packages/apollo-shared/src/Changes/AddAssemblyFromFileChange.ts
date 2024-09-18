/* eslint-disable @typescript-eslint/restrict-template-expressions */
/* eslint-disable @typescript-eslint/require-await */
import {
  ChangeOptions,
  ClientDataStore,
  LocalGFF3DataStore,
  SerializedAssemblySpecificChange,
  ServerDataStore,
} from '@apollo-annotation/common'
import { BgzipIndexedFasta } from '@gmod/indexedfasta'

import { FromFileBaseChange } from './FromFileBaseChange'

export interface SerializedAddAssemblyFromFileChangeBase
  extends SerializedAssemblySpecificChange {
  typeName: 'AddAssemblyFromFileChange'
}

export interface AddAssemblyFromFileChangeDetails {
  assemblyName: string
  fileIds: { fa: string } | { fa: string; fai: string; gzi: string }
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

export class AddAssemblyFromFileChange extends FromFileBaseChange {
  typeName = 'AddAssemblyFromFileChange' as const
  changes: AddAssemblyFromFileChangeDetails[]

  constructor(
    json: SerializedAddAssemblyFromFileChange,
    options?: ChangeOptions,
  ) {
    super(json, options)
    this.changes = 'changes' in json ? json.changes : [json]
  }

  get notification(): string {
    return `Assembly "${this.changes[0].assemblyName}" added successfully. To use it, please refresh the page.`
  }

  toJSON(): SerializedAddAssemblyFromFileChange {
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
    const { changes } = this
    for (const change of changes) {
      const { assemblyName, fileIds } = change
      await ('gzi' in fileIds
        ? this.executeOnServerIndexed(backend, assemblyName, fileIds)
        : this.executeOnServerFasta(backend, assemblyName, fileIds.fa))
    }
  }

  async executeOnServerIndexed(
    backend: ServerDataStore,
    assemblyName: string,
    fileIds: { fa: string; fai: string; gzi: string },
  ) {
    const { CHUNK_SIZE } = process.env
    const customChunkSize = CHUNK_SIZE && Number(CHUNK_SIZE)

    const { FILE_UPLOAD_FOLDER } = process.env
    if (!FILE_UPLOAD_FOLDER) {
      throw new Error('No FILE_UPLOAD_FOLDER found in .env file')
    }

    const { fa, fai, gzi } = fileIds
    const { assemblyModel, fileModel, filesService, refSeqModel, user } =
      backend

    const faDoc = await fileModel.findById(fa)
    const faChecksum = faDoc?.checksum
    if (!faChecksum) {
      throw new Error(`No checksum for file document ${faDoc}`)
    }

    const faiDoc = await fileModel.findById(fai)
    const faiChecksum = faiDoc?.checksum
    if (!faiChecksum) {
      throw new Error(`No checksum for file document ${faiDoc}`)
    }

    const gziDoc = await fileModel.findById(gzi)
    const gziChecksum = gziDoc?.checksum
    if (!gziChecksum) {
      throw new Error(`No checksum for file document ${gziDoc}`)
    }

    const sequenceAdapter = new BgzipIndexedFasta({
      fasta: filesService.getFileHandle(faDoc),
      fai: filesService.getFileHandle(faiDoc),
      gzi: filesService.getFileHandle(gziDoc),
    })
    const allSequenceSizes = await sequenceAdapter.getSequenceSizes()

    const assemblyDoc = await assemblyModel
      .findOne({ name: assemblyName })
      .exec()
    if (assemblyDoc) {
      throw new Error(`Assembly "${assemblyName}" already exists`)
    }
    const [newAssemblyDoc] = await assemblyModel.create([
      {
        _id: this.assembly,
        name: assemblyName,
        user,
        status: -1,
        fileIds,
      },
    ])
    this.logger.debug?.(
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
      this.logger.debug?.(
        `Added new refSeq "${sequenceName}", docId "${newRefSeqDoc._id}"`,
      )
    }
  }

  async executeOnServerFasta(
    backend: ServerDataStore,
    assemblyName: string,
    fileId: string,
  ) {
    const { assemblyModel, fileModel, user } = backend
    // Get file checksum
    const fileDoc = await fileModel.findById(fileId).exec()
    if (!fileDoc) {
      throw new Error(`File "${fileId}" not found in Mongo`)
    }
    this.logger.debug?.(`FileId "${fileId}", checksum "${fileDoc.checksum}"`)

    // Check and add new assembly
    const assemblyDoc = await assemblyModel
      .findOne({ name: assemblyName })
      .exec()
    if (assemblyDoc) {
      throw new Error(`Assembly "${assemblyName}" already exists`)
    }
    // Add assembly
    const [newAssemblyDoc] = await assemblyModel.create([
      { _id: this.assembly, name: assemblyName, user, status: -1, fileId },
    ])
    this.logger.debug?.(
      `Added new assembly "${assemblyName}", docId "${newAssemblyDoc._id}"`,
    )
    this.logger.debug?.(
      `File type: "${fileDoc.type}", assemblyId: "${newAssemblyDoc._id}"`,
    )

    // Add refSeqs
    // We cannot use Mongo 'session' / transaction here because Mongo has 16 MB limit for transaction
    await this.addRefSeqIntoDb(fileDoc, newAssemblyDoc._id.toString(), backend)
  }

  async executeOnLocalGFF3(_backend: LocalGFF3DataStore) {
    throw new Error('executeOnLocalGFF3 not implemented')
  }

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  async executeOnClient(_dataStore: ClientDataStore) {}

  getInverse() {
    const { assembly, changes, logger, typeName } = this
    return new AddAssemblyFromFileChange(
      { typeName, changes, assembly },
      { logger },
    )
  }
}
