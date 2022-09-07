import { AddAssemblyAndFeaturesFromFileChange } from './AddAssemblyAndFeaturesFromFileChange'
import { AddAssemblyFromFileChange } from './AddAssemblyFromFileChange'
import { AddFeatureChange } from './AddFeatureChange'
import { AddFeaturesFromFileChange } from './AddFeaturesFromFileChange'
import { CopyFeatureChange } from './CopyFeatureChange'
import { DeleteFeatureChange } from './DeleteFeatureChange'
import { LocationEndChange } from './LocationEndChange'
import { LocationStartChange } from './LocationStartChange'
import { TypeChange } from './TypeChange'

export const changes = {
  AddAssemblyAndFeaturesFromFileChange,
  AddAssemblyFromFileChange,
  AddFeatureChange,
  AddFeaturesFromFileChange,
  CopyFeatureChange,
  DeleteFeatureChange,
  LocationEndChange,
  LocationStartChange,
  TypeChange,
}

export * from './AddAssemblyAndFeaturesFromFileChange'
export * from './AddAssemblyFromFileChange'
export * from './AddFeaturesFromFileChange'
export * from './Change'
export * from './ChangeManager'
export * from './ChangeTypes'
export * from './AddFeatureChange'
export * from './CopyFeatureChange'
export * from './DeleteFeatureChange'
export * from './LocationEndChange'
export * from './LocationStartChange'
export * from './TypeChange'
