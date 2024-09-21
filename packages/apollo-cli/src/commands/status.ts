/* eslint-disable @typescript-eslint/no-unnecessary-condition */
import path from 'node:path'

import { ApolloConf, KEYS } from '../ApolloConf.js'
import { BaseCommand } from '../baseCommand.js'
import { basicCheckConfig } from '../utils.js'

export default class Status extends BaseCommand<typeof Status> {
  static summary = 'View authentication status'
  static description =
    'This command returns "<profile>: Logged in" if the selected profile \
has an access token and "<profile>: Logged out" otherwise.\
Note that this command does not check the validity of the access token.'

  public async run(): Promise<void> {
    const { flags } = await this.parse(Status)

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
    const accessToken: string = config.get(
      `${profileName}.${KEYS.accessToken}`,
    ) as string
    if (accessToken === undefined || accessToken.trim() === '') {
      this.log(`${profileName}: Logged out`)
    } else {
      this.log(`${profileName}: Logged in`)
    }
  }
}
