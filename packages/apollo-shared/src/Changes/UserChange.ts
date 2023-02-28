import {
  Change,
  ChangeOptions,
  ClientDataStore,
  LocalGFF3DataStore,
  SerializedChange,
  ServerDataStore,
} from 'apollo-common'

export interface SerializedUserChangeBase extends SerializedChange {
  typeName: 'UserChange'
  userId: string
}

export interface UserChangeDetails {
  role: 'admin' | 'user' | 'readOnly'
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
  userId: string

  constructor(json: SerializedUserChange, options?: ChangeOptions) {
    super(json, options)
    this.changes = 'changes' in json ? json.changes : [json]
    this.userId = json.userId
  }

  toJSON(): SerializedUserChange {
    const { changes, typeName, userId } = this
    if (changes.length === 1) {
      const [{ role }] = changes
      return { typeName, userId, role }
    }
    return { typeName, userId, changes }
  }

  async executeOnServer(backend: ServerDataStore) {
    const { userModel, session } = backend
    const { changes, userId, logger } = this

    for (const change of changes) {
      logger.debug?.(`change: ${JSON.stringify(changes)}`)
      const { role } = change
      const user = await userModel
        .findByIdAndUpdate(userId, { role })
        .session(session)
        .exec()
      if (!user) {
        const errMsg = `*** ERROR: User with id "${userId}" not found`
        logger.error(errMsg)
        throw new Error(errMsg)
      }
    }
  }

  async executeOnLocalGFF3(backend: LocalGFF3DataStore) {
    throw new Error('executeOnLocalGFF3 not implemented')
  }

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  async executeOnClient(dataStore: ClientDataStore) {}

  getInverse() {
    const { typeName, changes, userId, logger } = this
    return new UserChange({ typeName, changes, userId }, { logger })
  }
}
