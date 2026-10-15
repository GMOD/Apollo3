import {
  Change,
  type ChangeOptions,
  type SerializedChange,
} from '@apollo-annotation/common'

export interface SerializedDeleteUserChangeBase extends SerializedChange {
  typeName: 'DeleteUserChange'
  userId: string
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
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

  getInverse() {
    const { logger, typeName, userId } = this
    // The inverse would be an AddUserChange, but the deleted user's email
    // and role aren't known here. User changes aren't added to the undo stack.
    return new DeleteUserChange({ typeName, userId }, { logger })
  }
}
