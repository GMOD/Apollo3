export class CreateChangeDto {
  readonly assembly: string
  readonly changedIds: string[]
  readonly changes: unknown
  readonly reverts?: string
  readonly user: string
  readonly typeName: string
}
