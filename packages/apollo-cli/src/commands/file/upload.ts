import { Flags } from '@oclif/core'
import { Response } from 'undici'

import { FileCommand } from '../../fileCommand.js'
import { filterJsonList, queryApollo } from '../../utils.js'

export default class Upload extends FileCommand {
  static summary = 'Upload a local file to the Apollo server'
  static description = `This command only uploads a file and returns the corresponding file id.
  To add an assembly based on this file or to upload & add an assembly in a single pass \
  see \`apollo assembly add-from-fasta\` and \`add-from-gff\``
  static examples = [
    {
      description: 'Upload local file, type auto-detected:',
      command: '<%= config.bin %> <%= command.id %> -i genome.fa > file.json',
    },
  ]

  static flags = {
    'input-file': Flags.string({
      char: 'i',
      description: 'Local file to upload',
      required: true,
    }),
    type: Flags.string({
      char: 't',
      description:
        'Set file type or autodetected it if not set.\n\
        NB: There is no check for whether the file complies to this type',
      options: [
        'text/x-fasta',
        'text/x-gff3',
        'application/x-bgzip-fasta',
        'text/x-fai',
        'application/x-gzi',
      ],
    }),
    gzip: Flags.boolean({
      char: 'z',
      description:
        'Override autodetection and instruct that input is gzip compressed',
      exclusive: ['decompressed'],
    }),
    decompressed: Flags.boolean({
      char: 'd',
      description:
        'Override autodetection and instruct that input is decompressed',
      exclusive: ['gzip'],
    }),
  }

  public async run(): Promise<void> {
    const { flags } = await this.parse(Upload)

    const access = await this.getAccess()

    let { type } = flags
    if (type === undefined) {
      const hasGzipExt = flags['input-file'].endsWith('.gz')
      const infile = flags['input-file'].replace(/\.gz$/, '')

      if (/\.fasta$|\.fas$|\.fa$|\.fna$/.test(infile) && hasGzipExt) {
        this.error(
          `Unable to auto-detect file type for "${flags['input-file']}" since it may be gzip or bgzip compressed. Please set the -t/--type option`,
        )
      } else if (/\.fasta$|\.fas$|\.fa$|\.fna$/.test(infile)) {
        type = 'text/x-fasta'
      } else if (/\.gff$|\.gff3/.test(infile)) {
        type = 'text/x-gff3'
      } else if (infile.endsWith('.fai')) {
        type = 'text/x-fai'
      } else if (infile.endsWith('.gzi')) {
        type = 'application/x-gzi'
      } else {
        this.error(
          `Unable to auto-detect the type of file "${flags['input-file']}". Please set the --type/-t option.`,
        )
      }
    }

    let isGzip = flags['input-file'].endsWith('.gz')
    // eslint-disable-next-line unicorn/consistent-destructuring
    if (flags.gzip) {
      isGzip = true
    }
    // eslint-disable-next-line unicorn/consistent-destructuring
    if (flags.decompressed) {
      isGzip = false
    }

    this.logToStderr(`Input is gzip'd: ${isGzip}`)

    const fileId = await this.uploadFile(
      access.address,
      access.accessToken,
      flags['input-file'],
      type,

      isGzip,
    )

    const res: Response = await queryApollo(
      access.address,
      access.accessToken,
      'files',
    )
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const json = JSON.parse(await res.text())
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    const [rec] = filterJsonList(json, [fileId], '_id')
    this.log(JSON.stringify(rec, null, 2))
  }
}
