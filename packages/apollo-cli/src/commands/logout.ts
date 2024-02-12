import path from 'node:path'
import { BaseCommand } from '../baseCommand.js'

import { Config, KEYS } from '../Config.js'
import { ConfigError, basicCheckConfig } from '../utils.js'

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
    } catch (err) {
      if (err instanceof ConfigError) { 
        this.logToStderr(err.message)
        this.exit(1)
      }
    }

    const config: Config = new Config(configFile)
    
    config.set(KEYS.accessToken, '', flags.profile)
    config.writeConfigFile()
  }
}
