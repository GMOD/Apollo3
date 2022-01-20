import { Change } from './Change'

type ChangeType = new (...args: unknown[]) => Change

class ChangeTypeRegistry {
  changes: Map<string, ChangeType> = new Map()

  registerChange(name: string, changeType: ChangeType): void {
    if (this.changes.has(name)) {
      throw new Error(`change type "${name}" has already been registered`)
    }
    this.changes.set(name, changeType)
  }

  getChangeType(name: string): ChangeType {
    const RegisteredChangeType = this.changes.get(name)
    if (!RegisteredChangeType) {
      throw new Error(`No change constructor registered for "${name}"`)
    }
    return RegisteredChangeType
  }
}

/** global singleton of all known types of changes */
export const changeRegistry = new ChangeTypeRegistry()
