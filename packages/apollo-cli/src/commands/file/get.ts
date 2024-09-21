import { Flags } from '@oclif/core'
import { Response } from 'undici'

import { BaseCommand } from '../../baseCommand.js'
import { idReader, queryApollo } from '../../utils.js'

export default class Get extends BaseCommand<typeof Get> {
  static summary = 'Get list of files uploaded to the Apollo server'
  static description = 'Print to stdout the list of files in json format'

  static examples = [
    {
      description: 'Get files by id:',
      command: '<%= config.bin %> <%= command.id %> -i xyz abc',
    },
  ]

  static flags = {
    'file-id': Flags.string({
      char: 'i',
      description: 'Get files matching this IDs',
      multiple: true,
    }),
  }

  public async run(): Promise<void> {
    const { flags } = await this.parse(Get)

    const access = await this.getAccess()

    const files: Response = await queryApollo(
      access.address,
      access.accessToken,
      'files',
    )
    const json = (await files.json()) as object[]

    let fileIds: string[] = []
    if (flags['file-id'] !== undefined) {
      fileIds = await idReader(flags['file-id'])
    }

    const keep = []
    for (const x of json) {
      if (
        flags['file-id'] === undefined ||
        fileIds.includes(x['_id' as keyof typeof x])
      ) {
        keep.push(x)
      }
    }
    this.log(JSON.stringify(keep, null, 2))
  }
}
