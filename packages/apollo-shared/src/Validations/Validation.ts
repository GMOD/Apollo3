/* eslint-disable @typescript-eslint/no-unnecessary-condition */
/* eslint-disable @typescript-eslint/require-await */
import { type Change, type ClientDataStore } from '@apollo-annotation/common'
import { type FeatureDocument } from '@apollo-annotation/schemas'
import { type ExecutionContext } from '@nestjs/common'
import { type Reflector } from '@nestjs/core'
import { type ClientSession, type Model } from 'mongoose'

export interface Context {
  context: ExecutionContext
  reflector: Reflector
}

export function isContext(thing: Change | Context): thing is Context {
  return (
    (thing as Context).context !== undefined &&
    (thing as Context).reflector !== undefined
  )
}

export interface ValidationResult {
  validationName: string
  error?: { message: string }
}

export abstract class Validation {
  abstract name: string
  async frontendPreValidate(_change: Change): Promise<ValidationResult> {
    return { validationName: this.name }
  }

  async frontendPostValidate(
    _change: Change,
    _dataStore: ClientDataStore,
  ): Promise<ValidationResult> {
    return { validationName: this.name }
  }

  async backendPreValidate(
    _changeOrContext: Change | Context,
  ): Promise<ValidationResult> {
    return { validationName: this.name }
  }

  async backendPostValidate(
    _change: Change,
    _context: { session: ClientSession; featureModel: Model<FeatureDocument> },
  ): Promise<ValidationResult> {
    return { validationName: this.name }
  }

  async possibleValues(_key: string): Promise<unknown[] | undefined> {
    return undefined
  }
}
