import type { Change } from './Change.js'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ChangeConstructor = new (...args: any[]) => Change

class ChangeTypeRegistry {
  changes = new Map<string, ChangeConstructor>()

  registerChange(name: string, changeType: ChangeConstructor): void {
    if (this.changes.has(name)) {
      throw new Error(`change type "${name}" has already been registered`)
    }
    this.changes.set(name, changeType)
  }

  getChangeType(name: string): ChangeConstructor {
    const RegisteredChangeType = this.changes.get(name)
    if (!RegisteredChangeType) {
      throw new Error(`No change constructor registered for "${name}"`)
    }
    return RegisteredChangeType
  }
}

/** global singleton of all known types of changes */
export const changeRegistry = new ChangeTypeRegistry()
