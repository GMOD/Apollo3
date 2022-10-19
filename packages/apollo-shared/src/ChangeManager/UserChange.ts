import {
  Change,
  ChangeOptions,
  ClientDataStore,
  LocalGFF3DataStore,
  SerializedChange,
  ServerDataStore,
} from './Change'

export interface SerializedUserChangeBase extends SerializedChange {
  typeName: 'UserChange'
  userId: number
}

export interface UserChangeDetails {
  role: [{ type: string }]
}

export interface SerializedUserChangeSingle
  extends SerializedUserChangeBase,
    UserChangeDetails {}

export interface SerializedUserChangeMultiple extends SerializedUserChangeBase {
  changes: UserChangeDetails[]
}

export type SerializedUserChange =
  | SerializedUserChangeSingle
  | SerializedUserChangeMultiple

export class UserChange extends Change {
  typeName = 'UserChange' as const
  changes: UserChangeDetails[]
  userId: number

  constructor(json: SerializedUserChange, options?: ChangeOptions) {
    super(json, options)
    this.changes = 'changes' in json ? json.changes : [json]
    this.userId = json.userId
  }

  toJSON(): SerializedUserChange {
    if (this.changes.length === 1) {
      const [{ role }] = this.changes
      return {
        typeName: this.typeName,
        changedIds: this.changedIds,
        assemblyId: this.assemblyId,
        userId: this.userId,
        role,
      }
    }
    return {
      typeName: this.typeName,
      changedIds: this.changedIds,
      assemblyId: this.assemblyId,
      userId: this.userId,
      changes: this.changes,
    }
  }

  async applyToServer(backend: ServerDataStore) {
    const { userModel, session } = backend
    const { changes, userId } = this

    const user = await userModel.findById(userId).session(session).exec()
    if (!user) {
      const errMsg = `*** ERROR: User with id "${userId}" not found`
      this.logger.error(errMsg)
      throw new Error(errMsg)
    }

    for (const change of changes) {
      this.logger.debug?.(`change: ${JSON.stringify(changes)}`)
      const { role } = change
      user.role = role
      await user.save()
    }
  }

  async applyToLocalGFF3(backend: LocalGFF3DataStore) {
    throw new Error('applyToLocalGFF3 not implemented')
  }

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  async applyToClient(dataStore: ClientDataStore) {}

  getInverse() {
    const { changedIds, typeName, changes, assemblyId, userId } = this
    return new UserChange(
      { changedIds, typeName, changes, assemblyId, userId },
      { logger: this.logger },
    )
  }
}
