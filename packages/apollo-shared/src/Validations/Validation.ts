import { Change } from '../ChangeManager/Change'

export interface ValidationResult {
  validationName: string
  error?: {
    message: string
  }
}

export abstract class Validation {
  abstract getName(): string
  async frontendPreValidate(_change: Change): Promise<ValidationResult> {
    return { validationName: this.getName() }
  }

  async frontendPostValidate(_change: Change): Promise<ValidationResult> {
    return { validationName: this.getName() }
  }

  async backendPreValidate(_change: Change): Promise<ValidationResult> {
    return { validationName: this.getName() }
  }

  async backendPostValidate(_change: Change): Promise<ValidationResult> {
    return { validationName: this.getName() }
  }
}
