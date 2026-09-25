import {
  Change,
  type ChangeOptions,
  type SerializedChange,
} from '@apollo-annotation/common'

import type { UserChangeDetails } from './UserChange.js'

/**
 * Pre-approve a user by email before they have logged in. The user will be
 * created without a username, which is filled in when they first log in.
 */
export interface SerializedAddUserChange extends SerializedChange {
  typeName: 'AddUserChange'
  email: string
  role: UserChangeDetails['role']
}

export class AddUserChange extends Change {
  typeName = 'AddUserChange' as const
  email: string
  role: UserChangeDetails['role']

  constructor(json: SerializedAddUserChange, options?: ChangeOptions) {
    super(json, options)
    this.email = json.email
    this.role = json.role
  }

  toJSON(): SerializedAddUserChange {
    const { email, role, typeName } = this
    return { typeName, email, role }
  }

  getInverse() {
    // The inverse would be a DeleteUserChange, but the new user's ID isn't
    // known here. User changes aren't added to the undo stack.
    const { email, logger, role, typeName } = this
    return new AddUserChange({ typeName, email, role }, { logger })
  }
}
