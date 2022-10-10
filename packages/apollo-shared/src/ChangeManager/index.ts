import {
  AddAssemblyAndFeaturesFromFileChange,
  AddAssemblyFromFileChange,
  AddFeatureChange,
  AddFeaturesFromFileChange,
  CopyFeatureChange,
  DeleteFeatureChange,
  LocationEndChange,
  LocationStartChange,
  TypeChange,
} from './changes'

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

export * from './changes'
export * from './ChangeManager'
export * from './ChangeTypes'

export {
  SerializedChange,
  ClientDataStore,
  Change,
} from './changes/abstract/Change'
