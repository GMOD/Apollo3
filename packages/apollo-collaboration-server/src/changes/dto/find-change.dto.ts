export class FindChangeDto {
  readonly assembly: string
  readonly changedIds?: string[]
  readonly reverts?: string
  readonly user?: string
  readonly typeName?: string
}
