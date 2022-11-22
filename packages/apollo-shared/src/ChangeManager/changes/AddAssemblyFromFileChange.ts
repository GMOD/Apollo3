// import { getSession } from '@jbrowse/core/util'
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

export interface SerializedAddAssemblyFromFileChangeBase
  extends SerializedAssemblySpecificChange {
  typeName: 'AddAssemblyFromFileChange'
}

export interface AddAssemblyFromFileChangeDetails {
  assemblyName: string
  fileId: string
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

export class AddAssemblyFromFileChange extends AssemblySpecificChange {
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
    const { assemblyModel, fileModel, session } = backend
    const { changes, assembly, logger } = this

    for (const change of changes) {
      const { fileId, assemblyName } = change

      const { FILE_UPLOAD_FOLDER } = process.env
      if (!FILE_UPLOAD_FOLDER) {
        throw new Error('No FILE_UPLOAD_FOLDER found in .env file')
      }
      // Get file checksum
      const fileDoc = await fileModel.findById(fileId).session(session).exec()
      if (!fileDoc) {
        throw new Error(`File "${fileId}" not found in Mongo`)
      }
      logger.debug?.(`FileId "${fileId}", checksum "${fileDoc.checksum}"`)

      // Check and add new assembly
      const assemblyDoc = await assemblyModel
        .findOne({ name: assemblyName })
        .session(session)
        .exec()
      if (assemblyDoc) {
        throw new Error(`Assembly "${assemblyName}" already exists`)
      }
      // Add assembly
      const [newAssemblyDoc] = await assemblyModel.create(
        [{ _id: assembly, name: assemblyName }],
        { session },
      )
      logger.debug?.(
        `Added new assembly "${assemblyName}", docId "${newAssemblyDoc._id}"`,
      )
      logger.debug?.(`File type: "${fileDoc.type}"`)

      // Add refSeqs
      await this.addRefSeqIntoDb(fileDoc, newAssemblyDoc._id, backend)
    }
  }

  async applyToLocalGFF3(backend: LocalGFF3DataStore) {
    throw new Error('applyToLocalGFF3 not implemented')
  }

  async applyToClient(dataStore: ClientDataStore) {
    // console.log('ADD ASSEMBLY FROM FILE CHANGE')
    // const session = getSession(dataStore)
    // const { assembly, changes } = this
    // console.log(`CHANGE 0: ${JSON.stringify(changes)}`)
    // const tmpObject: any = changes
    // const assName = tmpObject.assemblyName
    // console.log(`ASS-NAME: ${JSON.stringify(assName)}`)
    // console.log(`ASSEMBLY: ${JSON.stringify(assembly)}`)
    // if (!dataStore) {
    //   throw new Error('No data store')
    // }
    // const ass = session.apolloDataStore.assemblies.get(assembly)
    // console.log(`ASS: ${JSON.stringify(ass)}`)
    // // If assemblyId is not present in client data store
    // if (!dataStore.assemblies.has(assembly)) {
    //   await session.addAssembly?.(assembly)
    //   dataStore.addAssembly(assembly, '')
    // }
  }

  getInverse() {
    const { typeName, changes, assembly, logger } = this
    return new AddAssemblyFromFileChange(
      { typeName, changes, assembly },
      { logger },
    )
  }
}
