import fs from 'node:fs'

import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PassportStrategy } from '@nestjs/passport'
import { HttpsProxyAgent } from 'https-proxy-agent'
import { Strategy } from 'passport-openidconnect'

import { AuthenticationService } from '../../authentication/authentication.service.js'

interface ConfigValues {
  LOGINGOV_CLIENT_ID?: string
  LOGINGOV_CLIENT_ID_FILE?: string
  LOGINGOV_CLIENT_SECRET?: string
  LOGINGOV_CLIENT_SECRET_FILE?: string
  LOGINGOV_ISSUER_BASE_URL?: string
  LOGINGOV_AUTHORIZATION_URL?: string
  LOGINGOV_TOKEN_URL?: string
  LOGINGOV_USER_INFO_URL?: string
  LOGINGOV_SCOPE?: string
  URL: string
  OAUTH_HTTP_PROXY?: string
}

interface LoginGovProfile {
  id: string
  displayName?: string
  emails?: { value: string }[]
  _json?: { email?: string; sub?: string }
}

@Injectable()
export class LoginGovStrategy extends PassportStrategy(Strategy, 'logingov') {
  private readonly logger = new Logger(LoginGovStrategy.name)

  constructor(
    private readonly authService: AuthenticationService,
    configService: ConfigService<ConfigValues, true>,
  ) {
    let clientID = configService.get('LOGINGOV_CLIENT_ID', { infer: true })
    if (!clientID) {
      const clientIDFile = configService.get('LOGINGOV_CLIENT_ID_FILE', {
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
    const issuerBaseURL =
      configService.get('LOGINGOV_ISSUER_BASE_URL', { infer: true }) ??
      'https://secure.login.gov'
    const authorizationURL =
      configService.get('LOGINGOV_AUTHORIZATION_URL', { infer: true }) ??
      `${issuerBaseURL}/openid_connect/authorize`
    const tokenURL =
      configService.get('LOGINGOV_TOKEN_URL', { infer: true }) ??
      `${issuerBaseURL}/api/openid_connect/token`
    const userInfoURL =
      configService.get('LOGINGOV_USER_INFO_URL', { infer: true }) ??
      `${issuerBaseURL}/api/openid_connect/userinfo`
    const scope =
      configService.get('LOGINGOV_SCOPE', { infer: true }) ??
      'openid email profile'

    if (configured) {
      clientSecret = configService.get('LOGINGOV_CLIENT_SECRET', {
        infer: true,
      })
      if (!clientSecret) {
        const clientSecretFile = configService.get(
          'LOGINGOV_CLIENT_SECRET_FILE',
          { infer: true },
        )!
        clientSecret = fs.readFileSync(clientSecretFile, 'utf8').trim()
      }
      const urlString = configService.get('URL', { infer: true })
      const callbackURI = new URL(urlString)
      callbackURI.pathname = `${callbackURI.pathname}${
        callbackURI.pathname.endsWith('/') ? '' : '/'
      }auth/logingov`
      callbackURL = callbackURI.href
    }

    super({
      issuer: issuerBaseURL,
      authorizationURL,
      tokenURL,
      userInfoURL,
      clientID,
      clientSecret,
      callbackURL,
      scope,
      state: true,
    })

    const proxy = configService.get('OAUTH_HTTP_PROXY', { infer: true })
    if (proxy) {
      const agent = new HttpsProxyAgent(proxy)
      const oauth2 = (this as any)._oauth2
      if (oauth2) {
        oauth2.setAgent(agent)
        this.logger.debug(`LoginGovStrategy configured to use proxy: ${proxy}`)
      }
    }
  }

  async validate(issuer: string, profile: LoginGovProfile) {
    return this.authService.loginGovLogin(profile)
  }
}
