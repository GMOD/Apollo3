import { Change } from '../ChangeManager/Change'

export interface ValidationResult {
  validationName: string
  error?: {
    message: string
  }
}

export abstract class Validation {
  abstract getName(): string
  frontendPreValidate(_change: Change): ValidationResult {
    return { validationName: this.getName() }
  }

  frontendPostValidate(_change: Change): ValidationResult {
    return { validationName: this.getName() }
  }

  backendPreValidate(_change: Change): ValidationResult {
    return { validationName: this.getName() }
  }

  backendPostValidate(_change: Change): ValidationResult {
    return { validationName: this.getName() }
  }
}
