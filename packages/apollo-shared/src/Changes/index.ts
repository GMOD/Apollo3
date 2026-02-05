import { AddAssemblyAliasesChange } from './AddAssemblyAliasesChange.js'
import { AddAssemblyAndFeaturesFromFileChange } from './AddAssemblyAndFeaturesFromFileChange.js'
import { AddAssemblyFromExternalChange } from './AddAssemblyFromExternalChange.js'
import { AddAssemblyFromFileChange } from './AddAssemblyFromFileChange.js'
import { AddFeatureChange } from './AddFeatureChange.js'
import { AddFeaturesFromFileChange } from './AddFeaturesFromFileChange.js'
import { AddRefSeqAliasesChange } from './AddRefSeqAliasesChange.js'
import { DeleteAssemblyChange } from './DeleteAssemblyChange.js'
import { DeleteFeatureChange } from './DeleteFeatureChange.js'
import { DeleteUserChange } from './DeleteUserChange.js'
import { FeatureAttributeChange } from './FeatureAttributeChange.js'
import { ImportJBrowseConfigChange } from './ImportJBrowseConfigChange.js'
import { LocationEndChange } from './LocationEndChange.js'
import { LocationStartChange } from './LocationStartChange.js'
import { MergeExonsChange } from './MergeExonsChange.js'
import { MergeTranscriptsChange } from './MergeTranscriptsChange.js'
import { SplitExonChange } from './SplitExonChange.js'
import { StrandChange } from './StrandChange.js'
import { TypeChange } from './TypeChange.js'
import { UndoMergeExonsChange } from './UndoMergeExonsChange.js'
import { UndoMergeTranscriptsChange } from './UndoMergeTranscriptsChange.js'
import { UndoSplitExonChange } from './UndoSplitExonChange.js'
import { UserChange } from './UserChange.js'

export const changes = {
  AddAssemblyAndFeaturesFromFileChange,
  AddAssemblyFromFileChange,
  AddAssemblyFromExternalChange,
  AddFeatureChange,
  AddFeaturesFromFileChange,
  DeleteAssemblyChange,
  DeleteFeatureChange,
  DeleteUserChange,
  FeatureAttributeChange,
  ImportJBrowseConfigChange,
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
  UserChange,
  AddRefSeqAliasesChange,
  AddAssemblyAliasesChange,
}

export * from './AddAssemblyAndFeaturesFromFileChange.js'
export * from './AddAssemblyFromFileChange.js'
export * from './AddAssemblyFromExternalChange.js'
export * from './AddFeatureChange.js'
export * from './AddFeaturesFromFileChange.js'
export * from './DeleteAssemblyChange.js'
export * from './DeleteFeatureChange.js'
export * from './DeleteUserChange.js'
export * from './FeatureAttributeChange.js'
export * from './ImportJBrowseConfigChange.js'
export * from './LocationEndChange.js'
export * from './LocationStartChange.js'
export * from './MergeExonsChange.js'
export * from './SplitExonChange.js'
export * from './MergeTranscriptsChange.js'
export * from './UndoMergeExonsChange.js'
export * from './UndoSplitExonChange.js'
export * from './UndoMergeTranscriptsChange.js'
export * from './StrandChange.js'
export * from './TypeChange.js'
export * from './UserChange.js'
export * from './AddRefSeqAliasesChange.js'
export * from './AddAssemblyAliasesChange.js'
