import fs from 'node:fs'

import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PassportStrategy } from '@nestjs/passport'
import { Strategy } from 'passport-microsoft'

import { AuthenticationService } from '../../authentication/authentication.service'

export interface Profile {
  provider: 'microsoft'
  name: { familyName: string; givenName: string }
  id: string
  displayName: string
  emails: { type: string; value: string }[]
}

interface ConfigValues {
  MICROSOFT_CLIENT_ID?: string
  MICROSOFT_CLIENT_ID_FILE?: string
  MICROSOFT_CLIENT_SECRET?: string
  MICROSOFT_CLIENT_SECRET_FILE?: string
  URL: string
  PORT: number
}

@Injectable()
export class MicrosoftStrategy extends PassportStrategy(Strategy) {
  private readonly logger = new Logger(MicrosoftStrategy.name)

  constructor(
    private readonly authService: AuthenticationService,
    configService: ConfigService<ConfigValues, true>,
  ) {
    let clientID = configService.get('MICROSOFT_CLIENT_ID', { infer: true })
    if (!clientID) {
      const clientIDFile = configService.get('MICROSOFT_CLIENT_ID_FILE', {
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
      clientSecret = configService.get('MICROSOFT_CLIENT_SECRET', {
        infer: true,
      })
      if (!clientSecret) {
        // We can use non-null assertion since joi already checks this for us
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const clientSecretFile = configService.get(
          'MICROSOFT_CLIENT_SECRET_FILE',
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
      }auth/microsoft/redirect`
      callbackURL = callbackURI.href
    }
    super({
      clientID,
      clientSecret,
      callbackURL,
      scope: ['user.read'],
      store: true,
    })
  }

  async validate(accessToken: string, refreshToken: string, profile: Profile) {
    return this.authService.microsoftLogin(profile)
  }
}
