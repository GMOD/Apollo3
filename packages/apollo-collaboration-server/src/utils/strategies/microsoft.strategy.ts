import { Injectable, Logger } from '@nestjs/common'
import { PassportStrategy } from '@nestjs/passport'
import { Strategy } from 'passport-microsoft'

import { AuthenticationService } from '../../authentication/authentication.service'

@Injectable()
export class MicrosoftStrategy extends PassportStrategy(Strategy) {
  private readonly logger = new Logger(MicrosoftStrategy.name)

  constructor(private readonly authService: AuthenticationService) {
    // const {
    //   GOOGLE_CLIENT_ID,
    //   GOOGLE_CLIENT_SECRET,
    //   GOOGLE_CALLBACK_URL,
    //   GOOGLE_SCOPE,
    // } = process.env
    // if (!GOOGLE_CLIENT_ID) {
    //   throw new Error('No GOOGLE_CLIENT_ID found in .env file')
    // }
    // if (!GOOGLE_CLIENT_SECRET) {
    //   throw new Error('No GOOGLE_CLIENT_SECRET found in .env file')
    // }
    // if (!GOOGLE_CALLBACK_URL) {
    //   throw new Error('No GOOGLE_CALLBACK_URL found in .env file')
    // }
    // if (!GOOGLE_SCOPE) {
    //   throw new Error('No GOOGLE_SCOPE found in .env file')
    // }
    super({
      clientID: '565a1a36-005f-4e54-83a0-5ac96128b06f',
      clientSecret: 'Vfq8Q~ZX.QdH4yNBQFCWDPJ1Cs7-~m4QpULytbke',
      callbackURL: 'http://localhost:3999/auth/microsoft/redirect',
      scope: ['user.read'],
      store: true,
    })
  }

  async validate(accessToken: string, refreshToken: string, profile: any) {
    this.logger.debug(`Microsoft token: ${accessToken}`)
    const user = await this.authService.microsoftLogin(profile)
    return user
  }
}
