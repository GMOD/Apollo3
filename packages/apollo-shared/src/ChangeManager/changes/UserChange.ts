import {
  Change,
  ChangeOptions,
  ClientDataStore,
  LocalGFF3DataStore,
  SerializedChange,
  ServerDataStore,
} from './abstract/Change'

export interface SerializedUserChangeBase extends SerializedChange {
  typeName: 'UserChange'
  userId: string
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

  async applyToServer(backend: ServerDataStore) {
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

  async applyToLocalGFF3(backend: LocalGFF3DataStore) {
    throw new Error('applyToLocalGFF3 not implemented')
  }

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  async applyToClient(dataStore: ClientDataStore) {}

  getInverse() {
    const { typeName, changes, userId, logger } = this
    return new UserChange({ typeName, changes, userId }, { logger })
  }
}
