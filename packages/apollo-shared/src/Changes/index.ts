import { AddAssemblyAndFeaturesFromFileChange } from './AddAssemblyAndFeaturesFromFileChange'
import { AddAssemblyFromExternalChange } from './AddAssemblyFromExternalChange'
import { AddAssemblyFromFileChange } from './AddAssemblyFromFileChange'
import { AddFeatureChange } from './AddFeatureChange'
import { AddFeaturesFromFileChange } from './AddFeaturesFromFileChange'
import { DeleteAssemblyChange } from './DeleteAssemblyChange'
import { DeleteFeatureChange } from './DeleteFeatureChange'
import { DeleteUserChange } from './DeleteUserChange'
import { DiscontinuousLocationChange } from './DiscontinuousLocationChange'
import { FeatureAttributeChange } from './FeatureAttributeChange'
import { LocationEndChange } from './LocationEndChange'
import { LocationStartChange } from './LocationStartChange'
import { TypeChange } from './TypeChange'
import { UserChange } from './UserChange'

export const changes = {
  AddAssemblyAndFeaturesFromFileChange,
  AddAssemblyFromFileChange,
  AddAssemblyFromExternalChange,
  AddFeatureChange,
  AddFeaturesFromFileChange,
  DeleteAssemblyChange,
  DeleteFeatureChange,
  FeatureAttributeChange,
  DeleteUserChange,
  LocationEndChange,
  LocationStartChange,
  DiscontinuousLocationChange,
  TypeChange,
  UserChange,
}

export * from './AddAssemblyAndFeaturesFromFileChange'
export * from './AddAssemblyFromFileChange'
export * from './AddAssemblyFromExternalChange'
export * from './AddFeatureChange'
export * from './AddFeaturesFromFileChange'
export * from './DeleteAssemblyChange'
export * from './DeleteFeatureChange'
export * from './DeleteUserChange'
export * from './FeatureAttributeChange'
export * from './LocationEndChange'
export * from './LocationStartChange'
export * from './DiscontinuousLocationChange'
export * from './TypeChange'
export * from './UserChange'
