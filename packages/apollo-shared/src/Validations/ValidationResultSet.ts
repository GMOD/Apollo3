import type { ValidationResult } from '@apollo-annotation/common'

/** The results of running a set of validations on a change */
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
