import fs from 'node:fs'

import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PassportStrategy } from '@nestjs/passport'
import { HttpsProxyAgent } from 'https-proxy-agent'
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
  OAUTH_HTTP_PROXY?: string
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
      callbackURI.pathname = `${callbackURI.pathname}${
        callbackURI.pathname.endsWith('/') ? '' : '/'
      }auth/microsoft`
      callbackURL = callbackURI.href
    }
    super({
      clientID,
      clientSecret,
      callbackURL,
      scope: ['user.read'],
      store: true,
    })

    // Apply proxy to OAuth2 instance
    const proxy = configService.get('OAUTH_HTTP_PROXY', { infer: true })
    if (proxy) {
      const agent = new HttpsProxyAgent(proxy)

      // Access the internal OAuth2 instance and set the agent
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
      const oauth2 = (this as any)._oauth2
      if (oauth2) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        oauth2.setAgent = agent
        this.logger.debug(
          `Microsoft Strategy configured to use proxy: ${proxy}`,
        )
      }
    }
  }

  async validate(accessToken: string, refreshToken: string, profile: Profile) {
    return this.authService.microsoftLogin(profile)
  }
}
