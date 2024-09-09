import { BaseCommand } from '../../baseCommand.js'
import { wrapLines, queryApollo } from '../../utils.js'

export default class GetConfig extends BaseCommand<typeof GetConfig> {
  static summary = 'Get Jbrowse configuration from Apollo'
  static description = wrapLines(
    'Print to stdout the Jbrowse configuration from Apollo in json format',
  )

  public async run(): Promise<void> {
    const { flags } = await this.parse(GetConfig)

    const access: { address: string; accessToken: string } =
      await this.getAccess(flags['config-file'], flags.profile)

    const response = await queryApollo(
      access.address,
      access.accessToken,
      'jbrowse/config.json',
    )

    if (!response.ok) {
      throw new Error('Failed to fetch jbrowse configuration')
    }

    const json = (await response.json()) as object
    this.log(JSON.stringify(json, null, 2))
  }
}
