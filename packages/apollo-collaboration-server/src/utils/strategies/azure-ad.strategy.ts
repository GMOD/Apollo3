import { Injectable, Logger } from '@nestjs/common'
import { PassportStrategy } from '@nestjs/passport'
import * as az from 'passport-azure-ad'
import { BearerStrategy } from 'passport-azure-ad'

import { AuthenticationService } from '../../authentication/authentication.service'

const clientID = '33cbcedd-c76f-450a-9206-caea1bceef5d'
const tenantID = '6b190bf3-8860-4a79-be38-31a715327efe'

@Injectable()
export class AzureADStrategy extends PassportStrategy(
  BearerStrategy,
  'azure-ad',
) {
  private readonly logger = new Logger(AzureADStrategy.name)

  constructor() {
    super({
      identityMetadata: `https://login.microsoftonline.com/${tenantID}/v2.0/.well-known/openid-configuration`,
      clientID,
    });
  }
  // constructor(private readonly authService: AuthenticationService) {
  //   const {
  //     GOOGLE_CLIENT_ID,
  //     GOOGLE_CLIENT_SECRET,
  //     GOOGLE_CALLBACK_URL,
  //     GOOGLE_SCOPE,
  //   } = process.env
  //   if (!GOOGLE_CLIENT_ID) {
  //     throw new Error('No GOOGLE_CLIENT_ID found in .env file')
  //   }
  //   if (!GOOGLE_CLIENT_SECRET) {
  //     throw new Error('No GOOGLE_CLIENT_SECRET found in .env file')
  //   }
  //   if (!GOOGLE_CALLBACK_URL) {
  //     throw new Error('No GOOGLE_CALLBACK_URL found in .env file')
  //   }
  //   if (!GOOGLE_SCOPE) {
  //     throw new Error('No GOOGLE_SCOPE found in .env file')
  //   }
  //   super({
  //     clientID: GOOGLE_CLIENT_ID,
  //     clientSecret: GOOGLE_CLIENT_SECRET,
  //     callbackURL: GOOGLE_CALLBACK_URL,
  //     scope: GOOGLE_SCOPE?.split(','),
  //   })
  // }

  async validate(data: any) {
    this.logger.debug(`Microsoft data: ${data}`)
    // const user = await this.authService.googleLogin(profile)
    return data
  }
  // async validate(accessToken: string, refreshToken: string, profile: Profile) {
  //   this.logger.debug(`Microsoft token: ${accessToken}`)
  //   const user = await this.authService.googleLogin(profile)
  //   return user
  // }
}
