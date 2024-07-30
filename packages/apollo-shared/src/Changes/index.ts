import { AddAssemblyAndFeaturesFromFileChange } from './AddAssemblyAndFeaturesFromFileChange'
import { AddAssemblyFromExternalChange } from './AddAssemblyFromExternalChange'
import { AddAssemblyFromFileChange } from './AddAssemblyFromFileChange'
import { AddFeatureChange } from './AddFeatureChange'
import { AddFeaturesFromFileChange } from './AddFeaturesFromFileChange'
import { AddRefSeqAliasesChange } from './AddRefSeqAliasesChange'
import { DeleteAssemblyChange } from './DeleteAssemblyChange'
import { DeleteFeatureChange } from './DeleteFeatureChange'
import { DeleteUserChange } from './DeleteUserChange'
import { DiscontinuousLocationEndChange } from './DiscontinuousLocationEndChange'
import { DiscontinuousLocationStartChange } from './DiscontinuousLocationStartChange'
import { FeatureAttributeChange } from './FeatureAttributeChange'
import { LocationEndChange } from './LocationEndChange'
import { LocationStartChange } from './LocationStartChange'
import { StrandChange } from './StrandChange'
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
  DeleteUserChange,
  DiscontinuousLocationEndChange,
  DiscontinuousLocationStartChange,
  FeatureAttributeChange,
  LocationEndChange,
  LocationStartChange,
  StrandChange,
  TypeChange,
  UserChange,
  AddRefSeqAliasesChange,
}

export * from './AddAssemblyAndFeaturesFromFileChange'
export * from './AddAssemblyFromFileChange'
export * from './AddAssemblyFromExternalChange'
export * from './AddFeatureChange'
export * from './AddFeaturesFromFileChange'
export * from './DeleteAssemblyChange'
export * from './DeleteFeatureChange'
export * from './DeleteUserChange'
export * from './DiscontinuousLocationEndChange'
export * from './DiscontinuousLocationStartChange'
export * from './FeatureAttributeChange'
export * from './LocationEndChange'
export * from './LocationStartChange'
export * from './StrandChange'
export * from './TypeChange'
export * from './UserChange'
export * from './AddRefSeqAliasesChange'
