import type { Change, ClientDataStore } from '@apollo-annotation/common'
import type { FeatureDocument } from '@apollo-annotation/schemas'
import type { ClientSession, Model } from 'mongoose'

import type { Context, Validation, ValidationResult } from './Validation.js'

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
  validations = new Set<Validation>()

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
  ): Promise<ValidationResultSet> {
    const results = new ValidationResultSet()
    for (const v of this.validations) {
      const result = await v.backendPreValidate(change)
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
      featureModel,
      session,
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
    return
  }
}

/** global singleton of all known types of changes */
export const validationRegistry = new ValidationSet()
