import { Injectable, Logger } from '@nestjs/common'
import { PassportStrategy } from '@nestjs/passport'
// import { BearerStrategy } from 'passport-azure-ad'
import passportazure from 'passport-azure-ad'

import { AuthenticationService } from '../../authentication/authentication.service'

const clientID = 'fabdd045-163c-4712-9d40-dbbb043b3090'
const tenantID = '6b190bf3-8860-4a79-be38-31a715327efe'
const { OIDCStrategy } = passportazure

@Injectable()
export class AzureADStrategy extends PassportStrategy(
  OIDCStrategy,
  'azure-ad',
) {
  private readonly logger = new Logger(AzureADStrategy.name)

  constructor() {
    super({
      identityMetadata: `https://login.microsoftonline.com/${tenantID}/v2.0/.well-known/openid-configuration`,
      clientID,
      responseType: 'id_token',
      responseMode: 'form_post',
      redirectUrl: 'http://localhost:3999/auth/azure-ad/redirect',
      allowHttpForRedirectUrl: true,
      validateIssuer: false,
      isB2C: false,
      issuer: null,
      passReqToCallback: false,
      scope: ['profile', 'offline_access'],
      loggingLevel: 'warn',
      nonceLifetime: null,
      nonceMaxAmount: 6,
      clockSkew: 300,
    })
  }

  async validate(data: any) {
    console.log('********** azure-ad strategy validation ************')
    this.logger.debug(`*** VALIDATION DATA: ${JSON.stringify(data)}`)
    this.logger.debug(`*** Return NAME: ${JSON.stringify(data._json.name)}`)
    this.logger.debug(`*** Return USERNAME: ${JSON.stringify(data._json.preferred_username)}`)
    // const user = await this.authService.googleLogin(profile)
    return data
  }
}
