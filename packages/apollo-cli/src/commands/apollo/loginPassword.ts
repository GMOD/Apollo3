import { Command } from '@oclif/core'

import { KeycloakService } from '../../services/keycloak.service'

export default class AuthLoginPassword extends Command {
  static description = 'Login with username and password'

  public async run(): Promise<void> {
    const keycloakService = new KeycloakService()


  }
}