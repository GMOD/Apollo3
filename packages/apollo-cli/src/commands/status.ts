import path from 'node:path'
import { BaseCommand } from '../baseCommand.js'
import { ConfigError, basicCheckConfig } from '../utils.js'
import { Config, KEYS } from '../Config.js'

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
    } catch (err) {
      if (err instanceof ConfigError) { 
        this.logToStderr(err.message)
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
