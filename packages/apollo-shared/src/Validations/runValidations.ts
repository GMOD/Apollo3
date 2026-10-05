import type { ValidationOutcome } from '@apollo-annotation/common'

import { ValidationResultSet } from './ValidationSet.js'

/**
 * Run validations in order, stopping at the first one that rejects the
 * change. `validate` returns an error message, or nothing if the validation
 * passes (including when it doesn't apply).
 */
export async function runValidations<V extends { name: string }>(
  validations: Iterable<V>,
  validate: (validation: V) => ValidationOutcome,
): Promise<ValidationResultSet> {
  const results = new ValidationResultSet()
  for (const validation of validations) {
    const message = await validate(validation)
    if (typeof message === 'string') {
      results.add({ validationName: validation.name, error: { message } })
      break
    } else {
      results.add({ validationName: validation.name })
    }
  }
  return results
}
