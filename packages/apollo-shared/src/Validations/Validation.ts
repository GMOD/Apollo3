import { FeatureDocument } from 'apollo-schemas'
import { Model } from 'mongoose'

import { Change, ClientDataStore } from '../ChangeManager/Change'

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

  async backendPreValidate(_change: Change): Promise<ValidationResult> {
    return { validationName: this.name }
  }

  async backendPostValidate(
    _change: Change,
    featureModel: Model<FeatureDocument>,
  ): Promise<ValidationResult> {
    return { validationName: this.name }
  }

  async possibleValues(key: string): Promise<unknown[] | undefined> {
    return undefined
  }
}
