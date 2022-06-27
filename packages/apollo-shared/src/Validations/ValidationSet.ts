import { FeatureDocument } from 'apollo-schemas'
import { Model } from 'mongoose'

import { Change, ClientDataStore } from '../ChangeManager/Change'
import { Validation, ValidationResult } from './Validation'

export class ValidationResultSet {
  results: ValidationResult[] = []
  ok = true
  add(result: ValidationResult) {
    this.results.push(result)
    if (result.error) {
      this.ok = false
    }
  }
}

export class ValidationSet {
  validations: Set<Validation>

  constructor(v: Validation[]) {
    this.validations = new Set(v)
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

  async backendPreValidate(change: Change): Promise<ValidationResultSet> {
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
    featureModel: Model<FeatureDocument>,
  ): Promise<ValidationResultSet> {
    const results = new ValidationResultSet()
    for (const v of this.validations) {
      const result = await v.backendPostValidate(change, featureModel)
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
