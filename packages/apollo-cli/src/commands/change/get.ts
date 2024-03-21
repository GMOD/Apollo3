import { Response } from 'node-fetch'

import { BaseCommand } from '../../baseCommand.js'
import { queryApollo } from '../../utils.js'

export default class Get extends BaseCommand<typeof Get> {
  static description = 'Get list of changes'

  public async run(): Promise<void> {
    const { flags } = await this.parse(Get)

    const access: { address: string; accessToken: string } =
      await this.getAccess(flags['config-file'], flags.profile)

    const changes: Response = await queryApollo(
      access.address,
      access.accessToken,
      'changes',
    )

    const json = await changes.json()
    this.log(JSON.stringify(json, null, 2))
  }
}
