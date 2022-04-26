export class ChangeLogDto {
  readonly assembly: string
  readonly changeId: string
  readonly features: string[]
  readonly change: string
  readonly reverts?: string
  readonly user: string
}
