import { Change } from '../ChangeManager/Change'
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

  frontendPreValidate(change: Change): ValidationResultSet {
    const results = new ValidationResultSet()
    for (const v of this.validations) {
      const result = v.frontendPreValidate(change)
      results.add(result)
      if (result.error) {
        break
      }
    }
    return results
  }

  frontendPostValidate(change: Change): ValidationResultSet {
    const results = new ValidationResultSet()
    for (const v of this.validations) {
      const result = v.frontendPostValidate(change)
      results.add(result)
      if (result.error) {
        break
      }
    }
    return results
  }

  backendPreValidate(change: Change): ValidationResultSet {
    const results = new ValidationResultSet()
    for (const v of this.validations) {
      const result = v.backendPreValidate(change)
      results.add(result)
      if (result.error) {
        break
      }
    }
    return results
  }

  backendPostValidate(change: Change): ValidationResultSet {
    const results = new ValidationResultSet()
    for (const v of this.validations) {
      const result = v.backendPostValidate(change)
      results.add(result)
      if (result.error) {
        break
      }
    }
    return results
  }
}
