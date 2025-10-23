/* eslint-disable @typescript-eslint/require-await */
import {
  type ChangeOptions,
  type ClientDataStore,
  type LocalGFF3DataStore,
  type SerializedAssemblySpecificChange,
  type ServerDataStore,
} from '@apollo-annotation/common'
import { type GFF3Feature } from '@gmod/gff'

import { FromFileBaseChange } from './FromFileBaseChange'

export interface SerializedAddFeaturesFromFileChangeBase
  extends SerializedAssemblySpecificChange {
  typeName: 'AddFeaturesFromFileChange'
  deleteExistingFeatures?: boolean
}

export interface AddFeaturesFromFileChangeDetails {
  fileId: string
  parseOptions?: { bufferSize: number }
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

export class AddFeaturesFromFileChange extends FromFileBaseChange {
  typeName = 'AddFeaturesFromFileChange' as const
  changes: AddFeaturesFromFileChangeDetails[]
  deleteExistingFeatures = false

  constructor(
    json: SerializedAddFeaturesFromFileChange,
    options?: ChangeOptions,
  ) {
    super(json, options)
    this.deleteExistingFeatures = json.deleteExistingFeatures ?? false
    this.changes = 'changes' in json ? json.changes : [json]
  }

  // eslint-disable-next-line @typescript-eslint/class-literal-property-style
  get notification(): string {
    return 'Features have been added. To see them, please refresh the page.'
  }

  toJSON(): SerializedAddFeaturesFromFileChange {
    const { assembly, changes, deleteExistingFeatures, typeName } = this
    if (changes.length === 1) {
      const [{ fileId }] = changes
      return { typeName, assembly, fileId, deleteExistingFeatures }
    }
    return { typeName, assembly, changes, deleteExistingFeatures }
  }

  /**
   * Applies the required change to database
   * @param backend - parameters from backend
   * @returns
   */
  async executeOnServer(backend: ServerDataStore) {
    const { fileModel, filesService } = backend
    const { changes, deleteExistingFeatures, logger } = this

    if (deleteExistingFeatures) {
      await this.removeExistingFeatures(backend)
    }

    for (const change of changes) {
      const { fileId, parseOptions } = change

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
      const { bufferSize = 10_000 } = parseOptions ?? {}
      const featureStream = filesService.parseGFF3(
        filesService.getFileStream(fileDoc),
        { bufferSize },
      )
      let featureCount = 0
      // @ts-expect-error type is wrong here
      // eslint-disable-next-line @typescript-eslint/await-thenable
      for await (const f of featureStream) {
        const gff3Feature = f as GFF3Feature

        // Add new feature into database
        // We cannot use Mongo 'session' / transaction here because Mongo has 16 MB limit for transaction
        await this.addFeatureIntoDb(gff3Feature, backend)
        featureCount++
        if (featureCount % 1000 === 0) {
          logger.debug?.(`Processed ${featureCount} features`)
        }
      }
    }
    logger.debug?.('New features added into database!')
  }

  async executeOnLocalGFF3(_backend: LocalGFF3DataStore) {
    throw new Error('executeOnLocalGFF3 not implemented')
  }

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  async executeOnClient(_dataStore: ClientDataStore) {}

  getInverse() {
    const { assembly, changes, logger, typeName } = this
    return new AddFeaturesFromFileChange(
      { typeName, changes, assembly },
      { logger },
    )
  }
}
