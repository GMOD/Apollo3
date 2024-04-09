import { Flags } from '@oclif/core'
import { fetch } from 'undici'

import { BaseCommand } from '../../baseCommand.js'
import { idReader, localhostToAddress, wrapLines } from '../../utils.js'

export default class Get extends BaseCommand<typeof Get> {
  static summary = 'Get features given their identifiers'
  static description = wrapLines(
    'Invalid identifiers or identifiers not found in the database will be silently ignored',
  )

  static examples = [
    {
      description: 'Get features for these identifiers:',
      command: '<%= config.bin %> <%= command.id %> -i abc...zyz def...foo',
    },
  ]

  static flags = {
    'feature-id': Flags.string({
      char: 'i',
      description: wrapLines(
        'Retrieves feature with these IDs to get. Use "-" to read IDs from stdin (one per line)',
        40,
      ),
      multiple: true,
      default: ['-'],
    }),
  }

  public async run(): Promise<void> {
    const { flags } = await this.parse(Get)

    const access: { address: string; accessToken: string } =
      await this.getAccess(flags['config-file'], flags.profile)

    let ids = idReader(flags['feature-id'])
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
    this.exit(0)
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
    if (response.ok) {
      return (await response.json()) as object
    }
    if (response.status === 404) {
      return {}
    }
    const msg = `Failed to access Apollo with the current address and/or access token\nThe server returned:\n${response.statusText}`
    throw new Error(msg)
  }
}
