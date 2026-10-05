/* eslint-disable @typescript-eslint/no-unnecessary-condition */
import { changeRegistry } from './ChangeTypeRegistry.js'

export interface SerializedChange {
  typeName: string
}

/**
 * A minimal logger, satisfied by `console` and by NestJS loggers. Only `log`,
 * `warn` and `error` are guaranteed to exist.
 */
export interface Logger {
  log(message: unknown, ...optionalParams: unknown[]): unknown
  warn(message: unknown, ...optionalParams: unknown[]): unknown
  error(message: unknown, ...optionalParams: unknown[]): unknown
  debug?(message: unknown, ...optionalParams: unknown[]): unknown
  verbose?(message: unknown, ...optionalParams: unknown[]): unknown
}

export interface ChangeOptions {
  logger: Logger
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function isChange(thing: any): thing is Change {
  return (thing as Change).getInverse !== undefined
}

export abstract class Change {
  /**
   * Logger for this change. Public (rather than protected) so that a change
   * class from one copy of this package is compatible with the `Change` type
   * from another copy, e.g. one bundled into a plugin.
   */
  readonly logger: Logger
  abstract typeName: string

  constructor(json: SerializedChange, options?: ChangeOptions) {
    this.logger = options?.logger ?? console
  }

  abstract toJSON(): SerializedChange

  /**
   * If a non-empty string, a snackbar will display in JBrowse with this message
   * when a successful response is received from the server.
   */
  // eslint-disable-next-line @typescript-eslint/class-literal-property-style
  get notification(): string {
    return ''
  }

  static fromJSON(json: SerializedChange, options?: ChangeOptions): Change {
    const ChangeType = changeRegistry.getChangeType(json.typeName)
    return new ChangeType(json, options?.logger && { logger: options.logger })
  }

  abstract getInverse(): Change
}
