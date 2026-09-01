import { BaseCommand } from '../../baseCommand.js'

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
    const json = (await this.get('jbrowse/config.json')) as object
    this.log(JSON.stringify(json, null, 2))
  }
}
