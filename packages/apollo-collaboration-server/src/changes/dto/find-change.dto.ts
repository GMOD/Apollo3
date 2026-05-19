export class FindChangeDto {
  readonly assembly?: string
  readonly changedIds?: string[]
  readonly reverts?: string
  readonly user?: string
  readonly typeName?: string
  readonly since?: string
  // Timestamp lower bound for createdAt
  readonly createdAfter?: string
  readonly sort?: string
  readonly limit?: string
  readonly offset?: string
}
