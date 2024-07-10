import { Flags } from '@oclif/core'
import { Response } from 'undici'

import { FileCommand } from '../../fileCommand.js'
import { filterJsonList, queryApollo, wrapLines } from '../../utils.js'

export default class Upload extends FileCommand {
  static summary = 'Upload a local file to the Apollo server'
  static description = wrapLines(
    'This command only uploads a file and returns the corresponding file id.\
    To add an assembly based on this file use `apollo assembly add-file`.\
    To upload & add an assembly in a single pass see commands `apollo assembly add-*`',
  )

  static examples = [
    {
      description: wrapLines('Upload local file, type auto-detected:'),
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
        'File type or "autodetect" for automatic detection.\nNB: There is no check for whether the file complies to this type',
      options: ['text/x-fasta', 'text/x-gff3', 'autodetect'],
      default: 'autodetect',
    }),
  }

  public async run(): Promise<void> {
    const { flags } = await this.parse(Upload)

    const access: { address: string; accessToken: string } =
      await this.getAccess(flags['config-file'], flags.profile)

    let { type } = flags
    if (type === 'autodetect') {
      if (/\.fasta$|\.fas$|\.fa$|\.fna$/.test(flags['input-file'])) {
        type = 'text/x-fasta'
      } else if (/\.gff$|\.gff3/.test(flags['input-file'])) {
        type = 'text/x-gff3'
      } else {
        this.error(
          `Unable to auto-detect the type of file "${flags['input-file']}". Please set the --type/-t option.`,
        )
      }
    }

    const fileId = await this.uploadFile(
      access.address,
      access.accessToken,
      flags['input-file'],
      type,
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
