import { GFF3Feature } from '@gmod/gff'

import {
  AssemblySpecificChange,
  ChangeOptions,
  ClientDataStore,
  LocalGFF3DataStore,
  SerializedAssemblySpecificChange,
  ServerDataStore,
} from './abstract'

export interface SerializedAddFeaturesFromFileChangeBase
  extends SerializedAssemblySpecificChange {
  typeName: 'AddFeaturesFromFileChange'
}

export interface AddFeaturesFromFileChangeDetails {
  fileId: string
}

export interface SerializedAddFeaturesFromFileChangeSingle
  extends SerializedAddFeaturesFromFileChangeBase,
    AddFeaturesFromFileChangeDetails {}

export interface SerializedAddFeaturesFromFileChangeMultiple
  extends SerializedAddFeaturesFromFileChangeBase {
  changes: AddFeaturesFromFileChangeDetails[]
}

export type SerializedAddFeaturesFromFileChange =
  | SerializedAddFeaturesFromFileChangeSingle
  | SerializedAddFeaturesFromFileChangeMultiple

export class AddFeaturesFromFileChange extends AssemblySpecificChange {
  typeName = 'AddFeaturesFromFileChange' as const
  changes: AddFeaturesFromFileChangeDetails[]

  constructor(
    json: SerializedAddFeaturesFromFileChange,
    options?: ChangeOptions,
  ) {
    super(json, options)
    this.changes = 'changes' in json ? json.changes : [json]
  }

  get notification(): string {
    return `Features have been added. To see them, please refresh the page.`
  }

  toJSON(): SerializedAddFeaturesFromFileChange {
    const { changes, typeName, assembly } = this
    if (changes.length === 1) {
      const [{ fileId }] = changes
      return { typeName, assembly, fileId }
    }
    return { typeName, assembly, changes }
  }

  /**
   * Applies the required change to database
   * @param backend - parameters from backend
   * @returns
   */
  async applyToServer(backend: ServerDataStore) {
    const { filesService, fileModel } = backend
    const { changes, logger } = this

    for (const change of changes) {
      const { fileId } = change

      const { FILE_UPLOAD_FOLDER } = process.env
      if (!FILE_UPLOAD_FOLDER) {
        throw new Error('No FILE_UPLOAD_FOLDER found in .env file')
      }
      // Get file checksum
      const fileDoc = await fileModel.findById(fileId).exec()
      if (!fileDoc) {
        throw new Error(`File "${fileId}" not found in Mongo`)
      }
      logger.debug?.(`FileId "${fileId}", checksum "${fileDoc.checksum}"`)

      // Read data from compressed file and parse the content
      const featureStream = filesService.parseGFF3(
        filesService.getFileStream(fileDoc),
      )
      for await (const f of featureStream) {
        const gff3Feature = f as GFF3Feature
        logger.verbose?.(`ENTRY=${JSON.stringify(gff3Feature)}`)

        // Add new feature into database
        // We cannot use Mongo 'session' / transaction here because Mongo has 16 MB limit for transaction
        await this.addFeatureIntoDb(gff3Feature, backend)
      }
    }
    logger.debug?.(`New features added into database!`)
  }

  async applyToLocalGFF3(backend: LocalGFF3DataStore) {
    throw new Error('applyToLocalGFF3 not implemented')
  }

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  async applyToClient(dataStore: ClientDataStore) {}

  getInverse() {
    const { typeName, changes, assembly, logger } = this
    return new AddFeaturesFromFileChange(
      { typeName, changes, assembly },
      { logger },
    )
  }
}
