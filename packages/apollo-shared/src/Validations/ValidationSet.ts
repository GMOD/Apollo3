import { FeatureDocument, UserDocument } from 'apollo-schemas'
import { ClientSession, Model } from 'mongoose'

import { Change, ClientDataStore } from '../Changes/abstract'
import { Context, Validation, ValidationResult } from './Validation'

export class ValidationResultSet {
  results: ValidationResult[] = []
  get resultsMessages() {
    return this.results
      .map((r) => r.error?.message)
      .filter(Boolean)
      .join(', ')
  }

  ok = true
  add(result: ValidationResult) {
    this.results.push(result)
    if (result.error) {
      this.ok = false
    }
  }
}

export class ValidationSet {
  validations: Set<Validation> = new Set()

  registerValidation(validation: Validation): void {
    this.validations.add(validation)
  }

  async frontendPreValidate(change: Change): Promise<ValidationResultSet> {
    const results = new ValidationResultSet()
    for (const v of this.validations) {
      const result = await v.frontendPreValidate(change)
      results.add(result)
      if (result.error) {
        break
      }
    }
    return results
  }

  async frontendPostValidate(
    change: Change,
    dataStore: ClientDataStore,
  ): Promise<ValidationResultSet> {
    const results = new ValidationResultSet()
    for (const v of this.validations) {
      const result = await v.frontendPostValidate(change, dataStore)
      results.add(result)
      if (result.error) {
        break
      }
    }
    return results
  }

  async backendPreValidate(
    change: Change | Context,
    { userModel }: { userModel: Model<UserDocument> },
  ): Promise<ValidationResultSet> {
    const results = new ValidationResultSet()
    for (const v of this.validations) {
      const result = await v.backendPreValidate(change, { userModel })
      results.add(result)
      if (result.error) {
        break
      }
    }
    return results
  }

  async backendPostValidate(
    change: Change,
    {
      session,
      featureModel,
    }: { session: ClientSession; featureModel: Model<FeatureDocument> },
  ): Promise<ValidationResultSet> {
    const results = new ValidationResultSet()
    for (const v of this.validations) {
      const result = await v.backendPostValidate(change, {
        featureModel,
        session,
      })
      results.add(result)
      if (result.error) {
        break
      }
    }
    return results
  }

  async possibleValues(key: string) {
    for (const v of this.validations) {
      const vals = await v.possibleValues(key)
      if (vals) {
        return vals
      }
    }
    return undefined
  }
}

/** global singleton of all known types of changes */
export const validationRegistry = new ValidationSet()
