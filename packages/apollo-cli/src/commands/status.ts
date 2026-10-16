/* eslint-disable @typescript-eslint/no-unnecessary-condition */
import { Buffer } from 'node:buffer'

import { KEYS } from '../ApolloConf.js'
import { BaseCommand } from '../baseCommand.js'

export default class Status extends BaseCommand<typeof Status> {
  static summary = 'View authentication status'
  static description =
    'This command returns "<profile>: Logged in" if the selected profile \
has an access token and "<profile>: Logged out" otherwise. \
When the token contains a username, returns "<profile>: Logged in as <username>". \
Note that this command does not check the validity of the access token.'

  public async run(): Promise<void> {
    const { flags } = await this.parse(Status)

    const profileName = flags.profile ?? process.env.APOLLO_PROFILE ?? 'default'

    const config = this.getConfig()
    const accessToken: string = config.get(
      `${profileName}.${KEYS.accessToken}`,
    ) as string
    if (accessToken === undefined || accessToken.trim() === '') {
      this.log(`${profileName}: Logged out`)
    } else {
      let username: string | undefined
      try {
        const payload: unknown = JSON.parse(
          Buffer.from(accessToken.split('.')[1] ?? '', 'base64url').toString(
            'utf8',
          ),
        )
        if (
          typeof payload === 'object' &&
          payload !== null &&
          'username' in payload &&
          typeof payload.username === 'string' &&
          payload.username.trim() !== ''
        ) {
          ;({ username } = payload)
        }
      } catch {
        // Keep reporting token presence if its payload cannot be decoded.
      }
      this.log(
        `${profileName}: Logged in${username === undefined ? '' : ` as ${username}`}`,
      )
    }
  }
}
