import type { Change } from '../Change.js'
import type { ChangeConstructor } from '../ChangeTypeRegistry.js'

import type { ServerPostValidationContext } from './ServerValidation.js'

/**
 * What a {@link ServerChangeType.handler} can use to apply a change: the user
 * submitting it, the MongoDB connection, a logger, and the session of the
 * transaction the change is applied in.
 */
export type ServerChangeContext = ServerPostValidationContext

/** A change type the server knows how to apply */
export interface ServerChangeType<C extends Change = Change> {
  /** The change class, used to deserialize submitted changes */
  changeType: ChangeConstructor
  /**
   * Apply the change to the database. Runs inside a transaction: pass
   * `context.session` to every query, and throw to reject the change, which
   * rolls back everything it did.
   */
  handler(change: C, context: ServerChangeContext): void | Promise<void>
  /**
   * The role a user needs to submit this change. Defaults to `'user'`.
   */
  requiredRole?: 'admin' | 'user'
}
