import { Flags } from '@oclif/core'
import { fetch } from 'undici'

import { BaseCommand } from '../../baseCommand.js'
import {
  createFetchErrorMessage,
  idReader,
  localhostToAddress,
} from '../../utils.js'

export default class Get extends BaseCommand<typeof Get> {
  static summary = 'Get features given their identifiers'
  static description =
    'Invalid identifiers or identifiers not found in the database will be silently ignored'

  static examples = [
    {
      description: 'Get features for these identifiers:',
      command: '<%= config.bin %> <%= command.id %> -i abc...zyz def...foo',
    },
  ]

  static flags = {
    'feature-id': Flags.string({
      char: 'i',
      description:
        'Retrieves feature with these IDs. Use "-" to read IDs from stdin (one per line)',
      multiple: true,
      default: ['-'],
    }),
  }

  public async run(): Promise<void> {
    const { flags } = await this.parse(Get)

    const access = await this.getAccess()

    let ids = await idReader(flags['feature-id'])
    ids = [...new Set(ids)]

    const results: object[] = []
    for (const id of ids) {
      const res = await this.getFeatureId(
        access.address,
        access.accessToken,
        id,
      )
      if (Object.keys(res).length === 0) {
        continue
      }
      results.push(res)
    }
    this.log(JSON.stringify(results, null, 2))
  }

  private async getFeatureId(
    address: string,
    token: string,
    featureId: string,
  ): Promise<object> {
    const url = new URL(localhostToAddress(`${address}/features/${featureId}`))
    const auth = {
      headers: {
        authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    }
    const response = await fetch(url, auth)
    if (!response.ok) {
      if (response.status === 404) {
        return {}
      }
      const errorMessage = await createFetchErrorMessage(
        response,
        'Failed to access Apollo with the current address and/or access token\nThe server returned:\n',
      )
      throw new Error(errorMessage)
    }
    return (await response.json()) as object
  }
}
