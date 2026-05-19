export class FindChangeDto {
  readonly assembly?: string
  readonly changedIds?: string[]
  readonly reverts?: string
  readonly user?: string
  readonly typeName?: string
  readonly since?: string
  readonly sort?: string
  readonly limit?: string
  readonly page?: string
  readonly pageSize?: string
  readonly sortField?: string
  readonly sortOrder?: string
  readonly startTime?: string
  readonly endTime?: string
}
