import { Flags } from '@oclif/core'

import { BaseCommand } from '../../baseCommand.js'
import {
  createFetchErrorMessage,
  filterJsonList,
  idReader,
} from '../../utils.js'

export default class Delete extends BaseCommand<typeof Delete> {
  static summary = 'Delete files from the Apollo server'
  static description =
    'Deleted files are printed to stdout. See also `apollo file get` to list the files on the server'

  static examples = [
    {
      description: 'Delete file multiple files:',
      command: '<%= config.bin %> <%= command.id %> -i 123...abc xyz...789',
    },
  ]

  static flags = {
    'file-id': Flags.string({
      char: 'i',
      description: 'IDs of the files to delete',
      default: ['-'],
      multiple: true,
    }),
  }

  public async run(): Promise<void> {
    const { flags } = await this.parse(Delete)

    const json = (await this.get('files')) as object[]

    const ff = await idReader(flags['file-id'])
    let deleted: object[] = []
    for (const id of ff) {
      const res = await this.deleteFile(id)
      if (res.status === 404) {
        this.logToStderr(`File id "${id}" not found`)
      } else {
        const fid = filterJsonList(json, [id], '_id')
        deleted = [...deleted, ...fid]
      }
    }
    this.log(JSON.stringify(deleted, null, 2))
    this.logToStderr(`${deleted.length.toString()} file(s) deleted.`)
  }

  async deleteFile(fileId: string) {
    const response = await this.fetch(`files/${fileId}`, {
      method: 'DELETE',
    })
    if (!response.ok && response.status != 404) {
      const errorMessage = await createFetchErrorMessage(
        response,
        'deleteFile failed',
      )
      throw new Error(errorMessage)
    }
    return response
  }
}
