import path from 'node:path'

import { BaseCommand } from '../baseCommand.js'
import { Config, KEYS } from '../Config.js'
import { ConfigError, basicCheckConfig } from '../utils.js'

export default class Status extends BaseCommand<typeof Status> {
  static description = 'View authentication status'

  public async run(): Promise<void> {
    const { flags } = await this.parse(Status)

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
    const accessToken: string = config.get(KEYS.accessToken, flags.profile)
    if (accessToken === undefined || accessToken.trim() === '') {
      this.log('Logged out')
    } else {
      this.log('Logged in')
    }
  }
}
