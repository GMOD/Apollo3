import { createWriteStream } from 'node:fs'
import { Writable } from 'node:stream'

import { Flags } from '@oclif/core'
import { type Response } from 'undici'

import { BaseCommand } from '../../baseCommand.js'
import { filterJsonList, idReader, queryApollo } from '../../utils.js'

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

    const access = await this.getAccess()

    const ff = await idReader([flags['file-id']])
    let res: Response = await queryApollo(
      access.address,
      access.accessToken,
      'files',
    )
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const json = JSON.parse(await res.text())
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    const [fileRec] = filterJsonList(json, ff, '_id')
    const fileId = fileRec['_id' as keyof typeof fileRec] as string

    res = await queryApollo(
      access.address,
      access.accessToken,
      `files/${fileId}`,
    )
    let { output } = flags
    if (output === undefined) {
      output = fileRec['basename' as keyof typeof fileRec] as string
    }
    const fileWriteStream = createWriteStream(output)
    await res.body?.pipeTo(
      Writable.toWeb(output === '-' ? process.stdout : fileWriteStream),
    )
    fileWriteStream.close()
  }
}
