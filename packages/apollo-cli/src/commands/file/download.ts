import { writeFileSync } from 'node:fs'

import { Flags } from '@oclif/core'
import { Response } from 'undici'

import { BaseCommand } from '../../baseCommand.js'
import {
  filterJsonList,
  idReader,
  queryApollo,
  wrapLines,
} from '../../utils.js'

export default class Download extends BaseCommand<typeof Download> {
  static summary = 'Download a file from the Apollo server'
  static description = wrapLines(
    'See also `apollo file get` to list the files on the server',
  )

  static examples = [
    {
      description: wrapLines('Download file with id xyz'),
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

    const access: { address: string; accessToken: string } =
      await this.getAccess(flags['config-file'], flags.profile)

    const ff = idReader([flags['file-id']])
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
    const text = await res.text()

    let { output } = flags
    if (output === undefined) {
      output = fileRec['basename' as keyof typeof fileRec] as string
    }
    writeFileSync(output === '-' ? 1 : output, text)
  }
}
