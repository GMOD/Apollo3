import {
  Change,
  ChangeOptions,
  ClientDataStore,
  LocalGFF3DataStore,
  SerializedChange,
  ServerDataStore,
} from './Change'

export interface SerializedDeleteUserChangeBase extends SerializedChange {
  typeName: 'DeleteUserChange'
  userId: number
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
  userId: number

  constructor(json: SerializedDeleteUserChange, options?: ChangeOptions) {
    super(json, options)
    this.changes = 'changes' in json ? json.changes : [json]
    this.userId = json.userId
  }

  toJSON(): SerializedDeleteUserChange {
    return {
      typeName: this.typeName,
      changedIds: this.changedIds,
      assemblyId: this.assemblyId,
      userId: this.userId,
    }
  }

  async applyToServer(backend: ServerDataStore) {
    const { userModel, session } = backend
    const { userId } = this
    const user = await userModel
      .findOneAndDelete({ id: userId })
      .session(session)
      .exec()
    if (!user) {
      const errMsg = `*** ERROR: User with id "${userId}" not found`
      this.logger.error(errMsg)
      throw new Error(errMsg)
    }
  }

  async applyToLocalGFF3(backend: LocalGFF3DataStore) {
    throw new Error('applyToLocalGFF3 not implemented')
  }

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  async applyToClient(dataStore: ClientDataStore) {}

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  getInverse() {
    const { changedIds, typeName, assemblyId, userId } = this
    return new DeleteUserChange(
      { changedIds, typeName, assemblyId, userId },
      { logger: this.logger },
    )
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
