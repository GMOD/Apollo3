/* eslint-disable @typescript-eslint/no-unnecessary-condition */
import { Buffer } from 'node:buffer'

import type { DecodedJWT } from '@apollo-annotation/shared'

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
        const payload = JSON.parse(
          Buffer.from(accessToken.split('.')[1] ?? '', 'base64url').toString(
            'utf8',
          ),
        ) as Partial<DecodedJWT> | null
        // Strip control characters so a crafted name can't inject terminal
        // escape sequences or line breaks into the output
        const trimmed = payload?.username?.replaceAll(/\p{Cc}/gu, '').trim()
        if (typeof trimmed === 'string' && trimmed !== '') {
          username = trimmed
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
