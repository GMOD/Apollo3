export class gff3ChangeObjectDto {
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

export class gff3ChangeLineObjectDto {
  filename: string
  rowid: string
  originalLine: string
  updatedLine: string
}

export class regionSearchObjectDto {
  refName: string
  start: number
  end: number
}

export class fastaQueryResult {
  id: string
  description: string
  sequence: string
}

export class fastaSequenceInfo {
  refName: string
  description: string
  length: number
}
