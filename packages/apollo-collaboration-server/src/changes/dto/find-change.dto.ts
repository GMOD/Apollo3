export class FindChangeDto {
  readonly assembly: string
  readonly changedIds?: string[]
  readonly reverts?: string
  readonly user?: string
  readonly typeName?: string
}

export class FindChangeBySequenceDto {
  readonly sequenceNumber: number
  readonly clientId: string
}

export class GetLastSequenceDto {
  readonly id: string
}
