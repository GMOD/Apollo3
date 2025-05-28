import { type Operation } from './Operation'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type OperationType = new (...args: any[]) => Operation

class OperationTypeRegistry {
  operations = new Map<string, OperationType>()

  registerOperation(name: string, operationType: OperationType): void {
    if (this.operations.has(name)) {
      throw new Error(`operation type "${name}" has already been registered`)
    }
    this.operations.set(name, operationType)
  }

  getOperationType(name: string): OperationType {
    const RegisteredOperationType = this.operations.get(name)
    if (!RegisteredOperationType) {
      throw new Error(`No operation constructor registered for "${name}"`)
    }
    return RegisteredOperationType
  }
}

/** global singleton of all known types of operations */
export const operationRegistry = new OperationTypeRegistry()
