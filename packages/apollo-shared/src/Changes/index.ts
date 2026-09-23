import {
  AddFeatureChange,
  DeleteFeatureChange,
} from './AddAndDeleteFeatureChanges.js'
import { AddFeaturesFromFileChange } from './AddFeaturesFromFileChange.js'
import { DeleteUserChange } from './DeleteUserChange.js'
import { FeatureAttributeChange } from './FeatureAttributeChange.js'
import { LocationEndChange } from './LocationEndChange.js'
import { LocationStartChange } from './LocationStartChange.js'
import {
  MergeExonsChange,
  UndoMergeExonsChange,
} from './MergeAndUndoMergeExonsChanges.js'
import {
  MergeTranscriptsChange,
  UndoMergeTranscriptsChange,
} from './MergeAndUndoMergeTranscriptsChanges.js'
import {
  SplitExonChange,
  UndoSplitExonChange,
} from './SplitAndUndoSplitExonChanges.js'
import { StrandChange } from './StrandChange.js'
import { TypeChange } from './TypeChange.js'
import { UserChange } from './UserChange.js'

export const localChanges = {
  AddFeatureChange,
  DeleteFeatureChange,
  FeatureAttributeChange,
  LocationEndChange,
  LocationStartChange,
  MergeExonsChange,
  SplitExonChange,
  MergeTranscriptsChange,
  UndoMergeExonsChange,
  UndoSplitExonChange,
  UndoMergeTranscriptsChange,
  StrandChange,
  TypeChange,
}

export const changes = {
  ...localChanges,
  AddFeaturesFromFileChange,
  DeleteUserChange,
  UserChange,
}

export * from './AddAndDeleteFeatureChanges.js'
export * from './AddFeaturesFromFileChange.js'
export * from './DeleteUserChange.js'
export * from './FeatureAttributeChange.js'
export * from './LocationEndChange.js'
export * from './LocationStartChange.js'
export * from './MergeAndUndoMergeExonsChanges.js'
export * from './MergeAndUndoMergeTranscriptsChanges.js'
export * from './SplitAndUndoSplitExonChanges.js'
export * from './StrandChange.js'
export * from './TypeChange.js'
export * from './UserChange.js'
