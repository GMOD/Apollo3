import { AddAssemblyAndFeaturesFromFileChange } from './AddAssemblyAndFeaturesFromFileChange'
import { AddAssemblyFromExternalChange } from './AddAssemblyFromExternalChange'
import { AddAssemblyFromFileChange } from './AddAssemblyFromFileChange'
import { AddFeatureChange } from './AddFeatureChange'
import { AddFeaturesFromFileChange } from './AddFeaturesFromFileChange'
import { AddRefSeqAliasesChange } from './AddRefSeqAliasesChange'
import { DeleteAssemblyChange } from './DeleteAssemblyChange'
import { DeleteFeatureChange } from './DeleteFeatureChange'
import { DeleteUserChange } from './DeleteUserChange'
import { FeatureAttributeChange } from './FeatureAttributeChange'
import { ImportJBrowseConfigChange } from './ImportJBrowseConfigChange'
import { LocationEndChange } from './LocationEndChange'
import { LocationStartChange } from './LocationStartChange'
import { MergeExonsChange } from './MergeExonsChange'
import { MergeTranscriptsChange } from './MergeTranscriptsChange'
import { SplitExonChange } from './SplitExonChange'
import { StrandChange } from './StrandChange'
import { TypeChange } from './TypeChange'
import { UndoMergeExonsChange } from './UndoMergeExonsChange'
import { UndoMergeTranscriptsChange } from './UndoMergeTranscriptsChange'
import { UndoSplitExonChange } from './UndoSplitExonChange'
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
export * from './ImportJBrowseConfigChange'
export * from './LocationEndChange'
export * from './LocationStartChange'
export * from './MergeExonsChange'
export * from './SplitExonChange'
export * from './MergeTranscriptsChange'
export * from './UndoMergeExonsChange'
export * from './UndoSplitExonChange'
export * from './UndoMergeTranscriptsChange'
export * from './StrandChange'
export * from './TypeChange'
export * from './UserChange'
export * from './AddRefSeqAliasesChange'
