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
