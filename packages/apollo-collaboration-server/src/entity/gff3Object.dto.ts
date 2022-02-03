export interface GFF3ChangeLineObjectDto {
  filename: string
  rowid: string
  originalLine: string
  updatedLine: string
}

export interface FastaSequenceInfo {
  refName: string
  description: string
  length: number
}

export interface ChangeObjectTmp {
  changedIds: string[]
  typeName: string
  changes: FeatureChangeTmp[]
}

export interface FeatureChangeTmp {
  featureId: string
  oldEnd: number
  newEnd: number
}
