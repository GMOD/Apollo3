/* eslint-disable @typescript-eslint/require-await */

import {
  ChangeOptions,
  ClientDataStore,
  LocalGFF3DataStore,
  SerializedAssemblySpecificChange,
  ServerDataStore,
} from '@apollo-annotation/common'
import { GFF3Feature } from '@gmod/gff'

import { FromFileBaseChange } from './FromFileBaseChange'

export interface SerializedAddAssemblyAndFeaturesFromFileChangeBase
  extends SerializedAssemblySpecificChange {
  typeName: 'AddAssemblyAndFeaturesFromFileChange'
}

export interface AddAssemblyAndFeaturesFromFileChangeDetails {
  assemblyName: string
  fileIds: { fa: string }
}

export interface SerializedAddAssemblyAndFeaturesFromFileChangeSingle
  extends SerializedAddAssemblyAndFeaturesFromFileChangeBase,
    AddAssemblyAndFeaturesFromFileChangeDetails {}

export interface SerializedAddAssemblyAndFeaturesFromFileChangeMultiple
  extends SerializedAddAssemblyAndFeaturesFromFileChangeBase {
  changes: AddAssemblyAndFeaturesFromFileChangeDetails[]
}

export type SerializedAddAssemblyAndFeaturesFromFileChange =
  | SerializedAddAssemblyAndFeaturesFromFileChangeSingle
  | SerializedAddAssemblyAndFeaturesFromFileChangeMultiple

export class AddAssemblyAndFeaturesFromFileChange extends FromFileBaseChange {
  typeName = 'AddAssemblyAndFeaturesFromFileChange' as const
  changes: AddAssemblyAndFeaturesFromFileChangeDetails[]

  constructor(
    json: SerializedAddAssemblyAndFeaturesFromFileChange,
    options?: ChangeOptions,
  ) {
    super(json, options)
    this.changes = 'changes' in json ? json.changes : [json]
  }

  get notification(): string {
    return `Assembly "${this.changes[0].assemblyName}" added successfully. To use it, please refresh the page.`
  }

  toJSON(): SerializedAddAssemblyAndFeaturesFromFileChange {
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
    const { assemblyModel, checkModel, fileModel, filesService, user } = backend
    const { assembly, changes, logger } = this
    for (const change of changes) {
      const { assemblyName, fileIds } = change
      const fileId = fileIds.fa

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

      // Check and add new assembly
      const assemblyDoc = await assemblyModel
        .findOne({ name: assemblyName })
        .exec()
      if (assemblyDoc) {
        throw new Error(`Assembly "${assemblyName}" already exists`)
      }
      // get checks
      const checkDocs = await checkModel.find({ default: true }).exec()
      const checks = checkDocs.map((checkDoc) => checkDoc._id.toHexString())
      // Add assembly
      const [newAssemblyDoc] = await assemblyModel.create([
        { _id: assembly, name: assemblyName, user, status: -1, fileId, checks },
      ])
      logger.debug?.(
        `Added new assembly "${assemblyName}", docId "${newAssemblyDoc._id.toHexString()}"`,
      )
      logger.debug?.(`File type: "${fileDoc.type}"`)

      // Add refSeqs
      // We cannot use Mongo 'session' / transaction here because Mongo has 16 MB limit for transaction
      await this.addRefSeqIntoDb(
        fileDoc,
        newAssemblyDoc._id.toString(),
        backend,
      )

      // Loop all features
      logger.debug?.(
        `**************** LOOPATAAN KAIKKI FEATURET SEURAAVAKSI File type: "${fileDoc.type}"`,
      )
      const featureStream = filesService.parseGFF3(
        filesService.getFileStream(fileDoc),
      )
      for await (const f of featureStream) {
        const gff3Feature = f as GFF3Feature
        logger.verbose?.(`ENTRY=${JSON.stringify(gff3Feature)}`)
        // Add new feature into database
        await this.addFeatureIntoDb(gff3Feature, backend)
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
    return new AddAssemblyAndFeaturesFromFileChange(
      { typeName, changes, assembly },
      { logger },
    )
  }
}
