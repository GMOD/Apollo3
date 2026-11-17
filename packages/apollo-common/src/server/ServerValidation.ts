import type { Connection } from 'mongoose'

import type { Change, Logger } from '../Change.js'
import type { ValidationOutcome } from '../ChangeRule.js'

/** The user submitting a change */
export interface ServerValidationUser {
  id: string
  username: string
  email: string
  role?: 'admin' | 'user' | 'readOnly' | 'none'
}

/** What a {@link ServerValidation} can see of the server */
export interface ServerValidationContext {
  user: ServerValidationUser
  /**
   * The MongoDB connection. Models can be retrieved with e.g.
   * `connection.model('Feature')`.
   */
  connection: Connection
  logger: Logger
}

/** What a {@link ServerValidation} can see after a change is applied */
export type ServerPostValidationContext = ServerValidationContext

/**
 * Validation of changes in the Apollo collaboration server. Implement either
 * or both methods; return an error message (or throw) to reject the change.
 */
export abstract class ServerValidation {
  abstract name: string

  /** Called before the change is applied */
  preValidate?(
    change: Change,
    context: ServerValidationContext,
  ): ValidationOutcome

  /**
   * Called after the change has been applied. There is no transaction, so
   * rejecting the change here does not undo it; checks that must prevent a
   * change from being saved belong in `preValidate`.
   */
  postValidate?(
    change: Change,
    context: ServerPostValidationContext,
  ): ValidationOutcome
}
