import { Flags } from '@oclif/core'
import { RequestInit, Response, fetch } from 'undici'

import { BaseCommand } from '../../baseCommand.js'
import {
  createFetchErrorMessage,
  filterJsonList,
  idReader,
  localhostToAddress,
  queryApollo,
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

    const access: { address: string; accessToken: string } =
      await this.getAccess(flags['config-file'], flags.profile)

    const files: Response = await queryApollo(
      access.address,
      access.accessToken,
      'files',
    )
    const json = (await files.json()) as object[]

    const ff = idReader(flags['file-id'])
    let deleted: object[] = []
    for (const id of ff) {
      const res = await deleteFile(access.address, access.accessToken, id)
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
}

async function deleteFile(
  address: string,
  accessToken: string,
  fileId: string,
): Promise<Response> {
  const auth: RequestInit = {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  }

  const url = new URL(localhostToAddress(`${address}/files/${fileId}`))
  const response: Response = await fetch(url, auth)
  if (!response.ok && response.status != 404) {
    const errorMessage = await createFetchErrorMessage(
      response,
      'deleteFile failed',
    )
    throw new Error(errorMessage)
  }
  return response
}
