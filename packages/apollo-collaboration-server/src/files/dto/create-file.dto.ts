export class CreateFileDto {
  readonly basename: string
  readonly checksum: string
  readonly type: 'text/x-gff3' | 'text/x-fasta'
  readonly user: string
  readonly filesize: number
  readonly filesizeCompressed: number
}
