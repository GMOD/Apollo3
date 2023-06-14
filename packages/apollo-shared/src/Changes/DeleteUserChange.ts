import {
  Change,
  ChangeOptions,
  ClientDataStore,
  LocalGFF3DataStore,
  SerializedChange,
  ServerDataStore,
} from 'apollo-common'

export interface SerializedDeleteUserChangeBase extends SerializedChange {
  typeName: 'DeleteUserChange'
  userId: string
}

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface DeleteUserChangeDetails {}

interface SerializedDeleteUserChangeSingle
  extends SerializedDeleteUserChangeBase,
    DeleteUserChangeDetails {}

interface SerializedDeleteUserChangeMultiple
  extends SerializedDeleteUserChangeBase {
  changes: DeleteUserChangeDetails[]
}

export type SerializedDeleteUserChange =
  | SerializedDeleteUserChangeSingle
  | SerializedDeleteUserChangeMultiple

export class DeleteUserChange extends Change {
  typeName = 'DeleteUserChange' as const
  changes: DeleteUserChangeDetails[]
  userId: string

  constructor(json: SerializedDeleteUserChange, options?: ChangeOptions) {
    super(json, options)
    this.changes = 'changes' in json ? json.changes : [json]
    this.userId = json.userId
  }

  toJSON(): SerializedDeleteUserChange {
    const { typeName, userId } = this
    return { typeName, userId }
  }

  async executeOnServer(backend: ServerDataStore) {
    const { session, userModel } = backend
    const { logger, userId } = this
    const user = await userModel
      .findOneAndDelete({ _id: userId })
      .session(session)
      .exec()
    if (!user) {
      const errMsg = `*** ERROR: User with id "${userId}" not found`
      logger.error(errMsg)
      throw new Error(errMsg)
    }
  }

  async executeOnLocalGFF3(backend: LocalGFF3DataStore) {
    throw new Error('executeOnLocalGFF3 not implemented')
  }

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  async executeOnClient(dataStore: ClientDataStore) {}

  getInverse() {
    const { logger, typeName, userId } = this
    return new DeleteUserChange({ typeName, userId }, { logger })
    //   const inverseChangedIds = this.changedIds.slice().reverse()
    //   const inverseChanges = this.changes
    //     .slice()
    //     .reverse()
    //     .map((deleteUserChange) => ({
    //       addedUser: deleteUserChange.userId,
    //     }))
    //   this.logger.debug?.(`INVERSE CHANGE '${JSON.stringify(inverseChanges)}'`)
    //   // return new AddUserChange()
    // }
  }
}
