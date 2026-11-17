import type { Change } from './Change.js'

/**
 * The outcome of validating a change: an error message if the change is
 * invalid, or nothing if it is valid.
 */
// eslint-disable-next-line @typescript-eslint/no-invalid-void-type
export type ValidationOutcome = string | void | Promise<string | void>

/** The result of running a single validation on a change */
export interface ValidationResult {
  validationName: string
  error?: { message: string }
}

/**
 * A rule about changes that only depends on the change itself. Rules are run
 * on both the client and the server, before the change is applied, so they
 * can't be bypassed by submitting a change to the server directly.
 *
 * For validation that needs the client's or the server's state, use a
 * `ClientValidation` (from `@apollo-annotation/common/client`) or a
 * `ServerValidation` (from `@apollo-annotation/common/server`).
 */
export abstract class ChangeRule {
  abstract name: string

  /** Return an error message if the change breaks this rule */
  abstract validate(change: Change): ValidationOutcome
}

export function isChangeRule(thing: unknown): thing is ChangeRule {
  return (
    typeof thing === 'object' &&
    thing !== null &&
    typeof (thing as Partial<ChangeRule>).validate === 'function'
  )
}
