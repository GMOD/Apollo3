import { Flags } from '@oclif/core'

import { BaseCommand } from '../../baseCommand.js'
import { filterJsonList, queryApollo } from '../../utils.js'

export default class Get extends BaseCommand<typeof Get> {
  static description = 'Get available assemblies <testme2>'

  static flags = {
    names: Flags.string({
      char: 'n',
      description: 'Get assemblies in this list of names',
      multiple: true,
    }),
  }

  public async run(): Promise<void> {
    const { flags } = await this.parse(Get)

    const access: { address: string; accessToken: string } =
      await this.getAccess(flags['config-file'], flags.profile)

    const assemblies: Response = await queryApollo(
      access.address,
      access.accessToken,
      'assemblies',
    )

    const json = await assemblies.json()
    const keep =
      flags.names === undefined
        ? json
        : filterJsonList(json, flags.names, 'name')
    this.log(JSON.stringify(keep, null, 2))
  }
}
