import { Command } from '@oclif/core'

import { KeycloakService } from '../services/keycloak.service.js'
import { saveUserCredentials } from '../utils.js'

export default class AuthLogout extends Command {
  static description = 'Log out of Keycloak'

  public async run(): Promise<void> {
    const keycloakService = new KeycloakService()

    await keycloakService.logout()

    saveUserCredentials({ accessToken: '' })

    this.log('Logged out of Keycloak ✅')
  }
}
