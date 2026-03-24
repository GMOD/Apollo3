/* eslint-disable @typescript-eslint/no-unnecessary-condition */
import type { LoggerService } from '@nestjs/common'

import { changeRegistry } from './ChangeTypeRegistry.js'

export interface SerializedChange {
  typeName: string
}

export interface ChangeOptions {
  logger: LoggerService
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function isChange(thing: any): thing is Change {
  return (thing as Change).getInverse !== undefined
}

export abstract class Change {
  protected logger: LoggerService
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
