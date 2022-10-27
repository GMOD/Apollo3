import { Injectable, Logger } from '@nestjs/common'
import { PassportStrategy } from '@nestjs/passport'
import { Profile, Strategy } from 'passport-google-oauth20'

import { AuthenticationService } from '../../authentication/authentication.service'

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy) {
  private readonly logger = new Logger(GoogleStrategy.name)

  constructor(private readonly authService: AuthenticationService) {
    const {
      GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET,
      GOOGLE_CALLBACK_URL,
      GOOGLE_SCOPE,
    } = process.env
    if (!GOOGLE_CLIENT_ID) {
      throw new Error('No GOOGLE_CLIENT_ID found in .env file')
    }
    if (!GOOGLE_CLIENT_SECRET) {
      throw new Error('No GOOGLE_CLIENT_SECRET found in .env file')
    }
    if (!GOOGLE_CALLBACK_URL) {
      throw new Error('No GOOGLE_CALLBACK_URL found in .env file')
    }
    if (!GOOGLE_SCOPE) {
      throw new Error('No GOOGLE_SCOPE found in .env file')
    }
    super({
      clientID: GOOGLE_CLIENT_ID,
      clientSecret: GOOGLE_CLIENT_SECRET,
      callbackURL: GOOGLE_CALLBACK_URL,
      scope: GOOGLE_SCOPE?.split(','),
      store: true,
    })
  }

  async validate(accessToken: string, refreshToken: string, profile: Profile) {
    this.logger.debug(`Google token: ${accessToken}`)
    const user = await this.authService.googleLogin(profile)
    return user
  }
}
