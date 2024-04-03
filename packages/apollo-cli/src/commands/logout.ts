import path from 'node:path'

import { BaseCommand } from '../baseCommand.js'
import { Config, ConfigError, KEYS } from '../Config.js'
import { basicCheckConfig, wrapLines } from '../utils.js'

export default class Logout extends BaseCommand<typeof Logout> {
  static summary = 'Logout of Apollo'
  static description = wrapLines(
    'Logout by removing the access token from the selected profile',
  )

  static examples = [
    {
      description: 'Logout default profile:',
      command: '<%= config.bin %> <%= command.id %>',
    },
    {
      description: 'Logout selected profile',
      command: '<%= config.bin %> <%= command.id %> --profile my-profile',
    },
  ]

  public async run(): Promise<void> {
    const { flags } = await this.parse(Logout)

    let configFile = flags['config-file']
    if (configFile === undefined) {
      configFile = path.join(this.config.configDir, 'config.yaml')
    }
    try {
      basicCheckConfig(configFile, flags.profile)
    } catch (error) {
      if (error instanceof ConfigError) {
        this.logToStderr(error.message)
        this.exit(1)
      }
    }

    const config: Config = new Config(configFile)

    config.set(KEYS.accessToken, '', flags.profile)
    config.writeConfigFile()
  }
}
