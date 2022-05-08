export class CreateFileDto {
  readonly basename: string
  readonly compressedFileName: string
  readonly checksum: string
  readonly type: string
  readonly user: string
}
