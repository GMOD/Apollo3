import path from 'node:path'

import { ApolloConf, KEYS } from '../ApolloConf.js'
import { BaseCommand } from '../baseCommand.js'
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

    let profileName = flags.profile
    if (profileName === undefined) {
      profileName = process.env.APOLLO_PROFILE ?? 'default'
    }

    let configFile = flags['config-file']
    if (configFile === undefined) {
      configFile = path.join(this.config.configDir, 'config.yml')
    }
    basicCheckConfig(configFile, profileName)
    const config: ApolloConf = new ApolloConf(configFile)
    config.delete(`${profileName}.${KEYS.accessToken}`)
  }
}
