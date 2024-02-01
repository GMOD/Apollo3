import { Command } from '@oclif/core'

import { saveUserCredentials } from '../utils.js'

export default class AuthLogout extends Command {
  static description = 'Log out of Keycloak'

  public async run(): Promise<void> {

    saveUserCredentials({ accessToken: '' })

    this.log('Logged out of Keycloak ✅')
  }
}
