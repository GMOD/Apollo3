/* eslint-disable @typescript-eslint/no-unnecessary-condition */
import path from 'node:path'

import { BaseCommand } from '../baseCommand.js'
import { Config, ConfigError, KEYS } from '../Config.js'
import { basicCheckConfig, wrapLines } from '../utils.js'

export default class Status extends BaseCommand<typeof Status> {
  static summary = 'View authentication status'
  static description = wrapLines(
    'This command returns "<profile>: Logged in" if the selected profile has an access token and "<profile>: Logged out" otherwise.\
    Note that this command does not check the validity of the access token.',
  )

  public async run(): Promise<void> {
    const { flags } = await this.parse(Status)

    let profileName = flags.profile
    if (profileName === undefined) {
      profileName = process.env.APOLLO_PROFILE ?? 'default'
    }

    let configFile = flags['config-file']
    if (configFile === undefined) {
      configFile = path.join(this.config.configDir, 'config.yaml')
    }
    try {
      basicCheckConfig(configFile, profileName)
    } catch (error) {
      if (error instanceof ConfigError) {
        this.logToStderr(error.message)
        this.exit(1)
      }
    }

    const config: Config = new Config(configFile)
    const accessToken: string = config.get(KEYS.accessToken, profileName)
    if (accessToken === undefined || accessToken.trim() === '') {
      this.log(`${profileName}: Logged out`)
    } else {
      this.log(`${profileName}: Logged in`)
    }
  }
}
