import { createWriteStream } from 'node:fs'
import { Writable } from 'node:stream'

import { Flags } from '@oclif/core'

import { BaseCommand } from '../../baseCommand.js'
import { filterJsonList, idReader } from '../../utils.js'

export default class Download extends BaseCommand<typeof Download> {
  static summary = 'Download a file from the Apollo server'
  static description =
    'See also `apollo file get` to list the files on the server'

  static examples = [
    {
      description: 'Download file with id xyz',
      command: '<%= config.bin %> <%= command.id %> -i xyz -o genome.fa',
    },
  ]

  static flags = {
    'file-id': Flags.string({
      char: 'i',
      description: 'ID of the file to download',
      default: '-',
    }),
    output: Flags.string({
      char: 'o',
      description:
        'Write output to this file or "-" for stdout. Default to the name of the uploaded file.',
    }),
  }

  public async run(): Promise<void> {
    const { flags } = await this.parse(Download)

    const ff = await idReader([flags['file-id']])
    const json = (await this.get('files')) as object[]
    const [fileRec] = filterJsonList(json, ff, '_id')
    const fileId = fileRec['_id' as keyof typeof fileRec] as string

    const res = await this.fetch(`files/${fileId}`)
    const { output = fileRec['basename' as keyof typeof fileRec] } = flags
    const fileWriteStream = createWriteStream(output)
    await res.body?.pipeTo(
      Writable.toWeb(output === '-' ? process.stdout : fileWriteStream),
    )
    fileWriteStream.close()
  }
}
