import { FeatureDocument, UserDocument } from 'apollo-schemas'
import { ClientSession, Model } from 'mongoose'

import {
  Change,
  ClientDataStore,
  ServerDataStore,
} from '../ChangeManager/Change'

export interface Context {
  context: import('@nestjs/common').ExecutionContext
  reflector: import('@nestjs/core').Reflector
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
    userModel: import('mongoose').Model<UserDocument>,
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
