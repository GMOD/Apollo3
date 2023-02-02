import type { ExecutionContext } from '@nestjs/common'
import type { Reflector } from '@nestjs/core'
import { FeatureDocument, UserDocument } from 'apollo-schemas'
import { ClientSession, Model } from 'mongoose'

import { Change, ClientDataStore } from '../ChangeManager/changes/abstract'

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
  error?: {
    message: string
  }
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
    { userModel }: { userModel: Model<UserDocument> },
  ): Promise<ValidationResult> {
    return { validationName: this.name }
  }

  async backendPostValidate(
    change: Change,
    {
      session,
      featureModel,
    }: { session: ClientSession; featureModel: Model<FeatureDocument> },
  ): Promise<ValidationResult> {
    return { validationName: this.name }
  }

  async possibleValues(key: string): Promise<unknown[] | undefined> {
    return undefined
  }
}
