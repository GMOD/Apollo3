import path from 'node:path'

import { BaseCommand } from '../baseCommand.js'
import { Config, ConfigError, KEYS } from '../Config.js'
import { basicCheckConfig } from '../utils.js'

export default class Logout extends BaseCommand<typeof Logout> {
  static description = 'Log out of Apollo'

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
