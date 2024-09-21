import { BaseCommand } from '../../baseCommand.js'
import { queryApollo } from '../../utils.js'

export default class GetConfig extends BaseCommand<typeof GetConfig> {
  static summary = 'Get JBrowse configuration from Apollo'
  static description =
    'Print to stdout the JBrowse configuration from Apollo in JSON format'

  static examples = [
    {
      description: 'Get JBrowse configuration:',
      command: '<%= config.bin %> <%= command.id %> > config.json',
    },
  ]

  public async run(): Promise<void> {
    const access = await this.getAccess()

    const response = await queryApollo(
      access.address,
      access.accessToken,
      'jbrowse/config.json',
    )

    if (!response.ok) {
      throw new Error('Failed to fetch JBrowse configuration')
    }

    const json = (await response.json()) as object
    this.log(JSON.stringify(json, null, 2))
  }
}
