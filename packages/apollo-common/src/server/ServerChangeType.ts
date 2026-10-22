import type { Change } from '../Change.js'
import type { ChangeConstructor } from '../ChangeTypeRegistry.js'

import type { ServerPostValidationContext } from './ServerValidation.js'

/**
 * What a {@link ServerChangeType.handler} can use to apply a change: the user
 * submitting it, the MongoDB connection, and a logger.
 */
export type ServerChangeContext = ServerPostValidationContext

/** A change type the server knows how to apply */
export interface ServerChangeType<C extends Change = Change> {
  /** The change class, used to deserialize submitted changes */
  changeType: ChangeConstructor
  /**
   * Apply the change to the database. Throw to reject the change. There is no
   * surrounding transaction, so check everything that could make the change
   * fail before writing anything.
   */
  handler(change: C, context: ServerChangeContext): void | Promise<void>
  /**
   * The role a user needs to submit this change. Defaults to `'user'`.
   */
  requiredRole?: 'admin' | 'user'
}
