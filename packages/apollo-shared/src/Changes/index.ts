import { Change } from './abstract'
import { AddAssemblyAndFeaturesFromFileChange } from './AddAssemblyAndFeaturesFromFileChange'
import { AddAssemblyFromFileChange } from './AddAssemblyFromFileChange'
import { AddFeatureChange } from './AddFeatureChange'
import { AddFeaturesFromFileChange } from './AddFeaturesFromFileChange'
import { CopyFeatureChange } from './CopyFeatureChange'
import { DeleteAssemblyChange } from './DeleteAssemblyChange'
import { DeleteFeatureChange } from './DeleteFeatureChange'
import { DeleteUserChange } from './DeleteUserChange'
import { FeatureAttributeChange } from './FeatureAttributeChange'
import { LocationEndChange } from './LocationEndChange'
import { LocationStartChange } from './LocationStartChange'
import { TypeChange } from './TypeChange'
import { UserChange } from './UserChange'

export const changes = {
  AddAssemblyAndFeaturesFromFileChange,
  AddAssemblyFromFileChange,
  AddFeatureChange,
  AddFeaturesFromFileChange,
  CopyFeatureChange,
  DeleteAssemblyChange,
  DeleteFeatureChange,
  FeatureAttributeChange,
  DeleteUserChange,
  LocationEndChange,
  LocationStartChange,
  TypeChange,
  UserChange,
}

export * from './AddAssemblyAndFeaturesFromFileChange'
export * from './AddAssemblyFromFileChange'
export * from './AddFeatureChange'
export * from './AddFeaturesFromFileChange'
export * from './CopyFeatureChange'
export * from './DeleteAssemblyChange'
export * from './DeleteFeatureChange'
export * from './DeleteUserChange'
export * from './FeatureAttributeChange'
export * from './LocationEndChange'
export * from './LocationStartChange'
export * from './TypeChange'
export * from './UserChange'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ChangeType = new (...args: any[]) => Change

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
