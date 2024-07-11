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

export interface SerializedAddAssemblyFromLocalChangeBase
  extends SerializedAssemblySpecificChange {
  typeName: 'AddAssemblyFromLocalChange'
}

export interface AddAssemblyFromLocalChangeDetails {
  assemblyName: string
  fileLocation: { fa: string; fai: string; gzi?: string }
}

export interface SerializedAddAssemblyFromLocalChangeSingle
  extends SerializedAddAssemblyFromLocalChangeBase,
    AddAssemblyFromLocalChangeDetails {}

export interface SerializedAddAssemblyFromLocalChangeMultiple
  extends SerializedAddAssemblyFromLocalChangeBase {
  changes: AddAssemblyFromLocalChangeDetails[]
}

export type SerializedAddAssemblyFromLocalChange =
  | SerializedAddAssemblyFromLocalChangeSingle
  | SerializedAddAssemblyFromLocalChangeMultiple

export class AddAssemblyFromLocalChange extends AssemblySpecificChange {
  typeName = 'AddAssemblyFromLocalChange' as const
  changes: AddAssemblyFromLocalChangeDetails[]

  constructor(
    json: SerializedAddAssemblyFromLocalChange,
    options?: ChangeOptions,
  ) {
    super(json, options)
    this.changes = 'changes' in json ? json.changes : [json]
  }

  get notification(): string {
    return `Assembly "${this.changes[0].assemblyName}" added successfully. To use it, please refresh the page.`
  }

  toJSON(): SerializedAddAssemblyFromLocalChange {
    const { assembly, changes, typeName } = this
    if (changes.length === 1) {
      const [{ assemblyName, fileLocation }] = changes
      return { typeName, assembly, assemblyName, fileLocation }
    }
    return { typeName, assembly, changes }
  }

  /**
   * Applies the required change to database
   * @param backend - parameters from backend
   * @returns
   */
  async executeOnServer(backend: ServerDataStore) {
    const { assemblyModel, refSeqModel, user } = backend
    const { assembly, changes, logger } = this
    const { CHUNK_SIZE } = process.env
    const customChunkSize = CHUNK_SIZE && Number(CHUNK_SIZE)

    for (const change of changes) {
      const { assemblyName, fileLocation } = change
      const { fa, fai, gzi } = fileLocation
      const sequenceAdapter = gzi
        ? new BgzipIndexedFasta({
            fasta: new LocalFile(fa, { fetch }),
            fai: new LocalFile(fai, { fetch }),
            gzi: new LocalFile(gzi, { fetch }),
          })
        : new IndexedFasta({
            fasta: new LocalFile(fa, { fetch }),
            fai: new LocalFile(fai, { fetch }),
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
          fileLocation,
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
    return new AddAssemblyFromLocalChange(
      { typeName, changes, assembly },
      { logger },
    )
  }
}
