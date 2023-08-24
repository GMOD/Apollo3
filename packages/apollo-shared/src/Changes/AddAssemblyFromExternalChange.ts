import { IndexedFasta } from '@gmod/indexedfasta'
import {
  AssemblySpecificChange,
  ChangeOptions,
  ClientDataStore,
  LocalGFF3DataStore,
  SerializedAssemblySpecificChange,
  ServerDataStore,
} from 'apollo-common'
import { RemoteFile } from 'generic-filehandle'

export interface SerializedAddAssemblyFromExternalChangeBase
  extends SerializedAssemblySpecificChange {
  typeName: 'AddAssemblyFromExternalChange'
}

export interface AddAssemblyFromExternalChangeDetails {
  assemblyName: string
  externalLocation: { fa: string; fai: string }
}

export interface SerializedAddAssemblyFromExternalChangeSingle
  extends SerializedAddAssemblyFromExternalChangeBase,
    AddAssemblyFromExternalChangeDetails {}

export interface SerializedAddAssemblyFromExternalChangeMultiple
  extends SerializedAddAssemblyFromExternalChangeBase {
  changes: AddAssemblyFromExternalChangeDetails[]
}

export type SerializedAddAssemblyFromExternalChange =
  | SerializedAddAssemblyFromExternalChangeSingle
  | SerializedAddAssemblyFromExternalChangeMultiple

export class AddAssemblyFromExternalChange extends AssemblySpecificChange {
  typeName = 'AddAssemblyFromExternalChange' as const
  changes: AddAssemblyFromExternalChangeDetails[]

  constructor(
    json: SerializedAddAssemblyFromExternalChange,
    options?: ChangeOptions,
  ) {
    super(json, options)
    this.changes = 'changes' in json ? json.changes : [json]
  }

  get notification(): string {
    return `Assembly "${this.changes[0].assemblyName}" added successfully. To use it, please refresh the page.`
  }

  toJSON(): SerializedAddAssemblyFromExternalChange {
    const { assembly, changes, typeName } = this
    if (changes.length === 1) {
      const [{ assemblyName, externalLocation }] = changes
      return { typeName, assembly, assemblyName, externalLocation }
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
      const { assemblyName, externalLocation } = change
      const { fa, fai } = externalLocation

      const allSequenceSizes = await new IndexedFasta({
        fasta: new RemoteFile(fa, { fetch }),
        fai: new RemoteFile(fai, { fetch }),
      }).getSequenceSizes()

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
          externalLocation,
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
    return new AddAssemblyFromExternalChange(
      { typeName, changes, assembly },
      { logger },
    )
  }
}
