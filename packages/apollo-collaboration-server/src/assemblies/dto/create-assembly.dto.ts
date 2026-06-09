export class CreateAssemblyDto {
  readonly name: string
  readonly displayName?: string
  readonly scientificName?: string
  readonly description?: string
  readonly aliases?: string[]
}
