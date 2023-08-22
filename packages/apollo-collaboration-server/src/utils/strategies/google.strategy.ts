import fs from 'node:fs'

import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PassportStrategy } from '@nestjs/passport'
import { Profile, Strategy } from 'passport-google-oauth20'

import { AuthenticationService } from '../../authentication/authentication.service'

interface ConfigValues {
  GOOGLE_CLIENT_ID?: string
  GOOGLE_CLIENT_ID_FILE?: string
  GOOGLE_CLIENT_SECRET?: string
  GOOGLE_CLIENT_SECRET_FILE?: string
  URL: string
  PORT: number
}

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy) {
  private readonly logger = new Logger(GoogleStrategy.name)

  constructor(
    private readonly authService: AuthenticationService,
    configService: ConfigService<ConfigValues, true>,
  ) {
    let clientID = configService.get('GOOGLE_CLIENT_ID', { infer: true })
    if (!clientID) {
      const clientIDFile = configService.get('GOOGLE_CLIENT_ID_FILE', {
        infer: true,
      })
      clientID = clientIDFile && fs.readFileSync(clientIDFile, 'utf8').trim()
    }
    const configured = Boolean(clientID)
    if (!configured) {
      clientID = 'none'
    }
    let clientSecret = 'none'
    let callbackURL
    if (configured) {
      clientSecret = configService.get('GOOGLE_CLIENT_SECRET', { infer: true })
      if (!clientSecret) {
        // We can use non-null assertion since joi already checks this for us
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const clientSecretFile = configService.get(
          'GOOGLE_CLIENT_SECRET_FILE',
          { infer: true },
        )!
        clientSecret = fs.readFileSync(clientSecretFile, 'utf8').trim()
      }
      const urlString = configService.get('URL', { infer: true })
      const callbackURI = new URL(urlString)
      const port = configService.get('PORT', { infer: true })
      callbackURI.port = String(port)
      callbackURI.pathname = `${callbackURI.pathname}${
        callbackURI.pathname.endsWith('/') ? '' : '/'
      }auth/google/redirect`
      callbackURL = callbackURI.href
    }
    super({
      clientID,
      clientSecret,
      callbackURL,
      scope: ['email', 'profile'],
      store: true,
    })
  }

  async validate(accessToken: string, refreshToken: string, profile: Profile) {
    return this.authService.googleLogin(profile)
  }
}
