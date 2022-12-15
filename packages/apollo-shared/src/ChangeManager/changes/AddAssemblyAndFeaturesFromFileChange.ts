import { GFF3Feature } from '@gmod/gff'

import {
  AssemblySpecificChange,
  SerializedAssemblySpecificChange,
} from './abstract/AssemblySpecificChange'
import {
  ChangeOptions,
  ClientDataStore,
  LocalGFF3DataStore,
  ServerDataStore,
} from './abstract/Change'

export interface SerializedAddAssemblyAndFeaturesFromFileChangeBase
  extends SerializedAssemblySpecificChange {
  typeName: 'AddAssemblyAndFeaturesFromFileChange'
}

export interface AddAssemblyAndFeaturesFromFileChangeDetails {
  assemblyName: string
  fileId: string
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

export class AddAssemblyAndFeaturesFromFileChange extends AssemblySpecificChange {
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
    const { changes, typeName, assembly } = this
    if (changes.length === 1) {
      const [{ fileId, assemblyName }] = changes
      return { typeName, assembly, assemblyName, fileId }
    }
    return { typeName, assembly, changes }
  }

  /**
   * Applies the required change to database
   * @param backend - parameters from backend
   * @returns
   */
  async applyToServer(backend: ServerDataStore) {
    const { assemblyModel, fileModel, filesService, user } = backend
    // const { assemblyModel, fileModel, filesService, session } = backend
    const { changes, assembly, logger } = this
    for (const change of changes) {
      const { fileId, assemblyName } = change

      const { FILE_UPLOAD_FOLDER } = process.env
      if (!FILE_UPLOAD_FOLDER) {
        throw new Error('No FILE_UPLOAD_FOLDER found in .env file')
      }
      // Get file checksum
      const fileDoc = await fileModel.findById(fileId).exec()
      // const fileDoc = await fileModel.findById(fileId).session(session).exec()
      if (!fileDoc) {
        throw new Error(`File "${fileId}" not found in Mongo`)
      }
      logger.debug?.(`FileId "${fileId}", checksum "${fileDoc.checksum}"`)

      // Check and add new assembly
      const assemblyDoc = await assemblyModel
        .findOne({ name: assemblyName })
        // .session(session)
        .exec()
      if (assemblyDoc) {
        throw new Error(`Assembly "${assemblyName}" already exists`)
      }
      // Add assembly
      const [newAssemblyDoc] = await assemblyModel.create(
        [{ _id: assembly, name: assemblyName, user, status: -1 }],
        // { session },
      )
      logger.debug?.(
        `Added new assembly "${assemblyName}", docId "${newAssemblyDoc._id}"`,
      )
      logger.debug?.(`File type: "${fileDoc.type}"`)

      // Add refSeqs
      await this.addRefSeqIntoDb(fileDoc, newAssemblyDoc._id, backend)

      // Loop all features
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

  async applyToLocalGFF3(backend: LocalGFF3DataStore) {
    throw new Error('applyToLocalGFF3 not implemented')
  }

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  async applyToClient(dataStore: ClientDataStore) {}

  getInverse() {
    const { typeName, changes, assembly, logger } = this
    return new AddAssemblyAndFeaturesFromFileChange(
      { typeName, changes, assembly },
      { logger },
    )
  }
}
