export interface GFF3ChangeLineObjectDto {
  filename: string
  rowid: string
  originalLine: string
  updatedLine: string
}

export interface FastaSequenceInfo {
  refName: string
  description?: string
  length: number
}

export interface ChangeObjectTmp {
  // changedIds: string[]
  // typeName: string
  changes: FeatureChangeTmp[]
}

export interface FeatureChangeTmp {
  featureId: string
  oldEnd: number
  newEnd: number
}

export class FeatureRangeSearchDto {
  /** Reference sequence ID */
  refSeq: string
  /** Start of the range (0-based) */
  start: number
  /** End of the range */
  end: number
}

export class FeatureIdsSearchDto {
  /** Feature IDs to get */
  featureIds: string[]
  /** Return the top-level features that contain the requested features */
  topLevel?: boolean
}
