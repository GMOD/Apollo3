import {
  Change,
  type ChangeOptions,
  type SerializedChange,
} from '@apollo-annotation/common'

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

  getInverse() {
    const { changes, logger, typeName, userId } = this
    return new UserChange({ typeName, changes, userId }, { logger })
  }
}
