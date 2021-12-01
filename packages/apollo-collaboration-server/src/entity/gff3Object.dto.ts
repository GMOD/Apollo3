export interface GFF3ChangeObjectDto {
  filename: string
  seqid: string
  source: string
  type: string
  start: number
  end: number
  score: number
  strand: string
  phase: string
  attributes: { key: string; value: string }[]
}

export interface GFF3ChangeLineObjectDto {
  filename: string
  rowid: string
  originalLine: string
  updatedLine: string
}

export interface RegionSearchObjectDto {
  refName: string
  start: number
  end: number
}

export interface FastaQueryResult {
  id: string
  description: string
  sequence: string
}

export interface FastaSequenceInfo {
  refName: string
  description: string
  length: number
}
