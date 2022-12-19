import { Injectable, Logger } from '@nestjs/common'
import { PassportStrategy } from '@nestjs/passport'
import { Strategy } from 'passport-microsoft'

import { AuthenticationService } from '../../authentication/authentication.service'

export interface Profile {
  provider: 'microsoft'
  name: {
    familyName: string
    givenName: string
  }
  id: string
  displayName: string
  emails: {
    type: string
    value: string
  }[]
}

@Injectable()
export class MicrosoftStrategy extends PassportStrategy(Strategy) {
  private readonly logger = new Logger(MicrosoftStrategy.name)

  constructor(private readonly authService: AuthenticationService) {
    const {
      MICROSOFT_CLIENT_ID,
      MICROSOFT_CLIENT_SECRET,
      MICROSOFT_CALLBACK_URL,
      MICROSOFT_SCOPE,
    } = process.env
    if (!MICROSOFT_CLIENT_ID) {
      throw new Error('No MICROSOFT_CLIENT_ID found in .env file')
    }
    if (!MICROSOFT_CLIENT_SECRET) {
      throw new Error('No MICROSOFT_CLIENT_SECRET found in .env file')
    }
    if (!MICROSOFT_CALLBACK_URL) {
      throw new Error('No MICROSOFT_CALLBACK_URL found in .env file')
    }
    if (!MICROSOFT_SCOPE) {
      throw new Error('No MICROSOFT_SCOPE found in .env file')
    }
    super({
      clientID: MICROSOFT_CLIENT_ID,
      clientSecret: MICROSOFT_CLIENT_SECRET,
      callbackURL: MICROSOFT_CALLBACK_URL,
      scope: MICROSOFT_SCOPE?.split(','),
      store: true,
    })
  }

  async validate(accessToken: string, refreshToken: string, profile: Profile) {
    return this.authService.microsoftLogin(profile)
  }
}
