import { Command } from '@oclif/core'

import { getUserCredentials } from '../utils.js'

export interface UserCredentials {
  accessToken: string
}

export default class AuthStatus extends Command {
  static description = 'View authentication status'

  public async run(): Promise<void> {
    const userCredentials = getUserCredentials()

    if (userCredentials) {
      this.log(`Logged in with token ${userCredentials.accessToken}`)
    } else {
      this.log("You're not logged in. Run `apollo login` to authenticate.")
    }
  }
}
