import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { Request } from 'express'
import * as client from 'openid-client'
import { ProxyAgent, fetch as undiciFetch } from 'undici'

import { type OidcProviderConfig, loadOidcProviders } from './oidc.config.js'

interface OidcLoginState {
  state: string
  nonce: string
  codeVerifier: string
  redirectUri: string
}

declare module 'express-session' {
  interface SessionData {
    oidc?: Record<string, OidcLoginState>
  }
}

interface ConfigValues {
  URL: string
  OAUTH_HTTP_PROXY?: string
}

@Injectable()
export class OidcService {
  private readonly logger = new Logger(OidcService.name)
  private readonly providers: Map<string, OidcProviderConfig>
  private readonly configurations = new Map<
    string,
    Promise<client.Configuration>
  >()
  private readonly baseURL: string
  private readonly customFetch?: client.CustomFetch

  constructor(configService: ConfigService<ConfigValues, true>) {
    this.providers = new Map(
      loadOidcProviders((key) =>
        configService.get<string | undefined>(key as keyof ConfigValues),
      ).map((provider) => [provider.name, provider]),
    )
    this.baseURL = configService.get('URL', { infer: true })
    const proxy = configService.get('OAUTH_HTTP_PROXY', { infer: true })
    if (proxy) {
      const dispatcher = new ProxyAgent(proxy)
      this.customFetch = (url, options) =>
        undiciFetch(url, {
          ...options,
          dispatcher,
        })
      this.logger.debug(`OIDC login configured to use proxy: ${proxy}`)
    }
    if (this.providers.size > 0) {
      this.logger.log(
        `Configured OIDC login providers: ${[...this.providers.keys()].join(', ')}`,
      )
    }
  }

  has(name: string) {
    return this.providers.has(name)
  }

  list() {
    return [...this.providers.values()]
  }

  /** The URL the identity provider redirects back to after login */
  private getCallbackURL(name: string) {
    const callbackURL = new URL(this.baseURL)
    callbackURL.pathname = `${callbackURL.pathname}${
      callbackURL.pathname.endsWith('/') ? '' : '/'
    }auth/${name}`
    return callbackURL
  }

  /**
   * Get the client configuration for a provider, fetching the issuer's
   * discovery document the first time. Failed discoveries are not cached so
   * that the next login attempt retries.
   */
  private getConfiguration(provider: OidcProviderConfig) {
    let configuration = this.configurations.get(provider.name)
    if (!configuration) {
      const issuer = new URL(provider.issuer)
      const options: client.DiscoveryRequestOptions = {}
      if (this.customFetch) {
        options[client.customFetch] = this.customFetch
      }
      if (issuer.protocol === 'http:') {
        this.logger.warn(
          `OIDC provider "${provider.name}" uses an insecure http:// issuer, this should only be used for local development`,
        )
        // Only "deprecated" to discourage use outside local development
        // eslint-disable-next-line @typescript-eslint/no-deprecated
        options.execute = [client.allowInsecureRequests]
      }
      // Prefer sending the client secret in the request body. Some providers,
      // including Google, reject client_secret_basic because they don't decode
      // the URL-encoded credentials the spec requires, so only use it if the
      // provider doesn't support client_secret_post.
      const secretPost = client.ClientSecretPost(provider.clientSecret)
      const secretBasic = client.ClientSecretBasic(provider.clientSecret)
      const clientAuth: client.ClientAuth = (as, ...args) => {
        const supported = as.token_endpoint_auth_methods_supported
        const useBasic =
          supported &&
          !supported.includes('client_secret_post') &&
          supported.includes('client_secret_basic')
        if (useBasic) {
          secretBasic(as, ...args)
        } else {
          secretPost(as, ...args)
        }
      }
      configuration = client
        .discovery(issuer, provider.clientId, undefined, clientAuth, options)
        .then((config) => {
          if (this.customFetch) {
            config[client.customFetch] = this.customFetch
          }
          return config
        })
      configuration.catch((error: unknown) => {
        this.logger.error(
          `OIDC discovery failed for "${provider.name}" (${provider.issuer}): ${String(error)}`,
        )
        this.configurations.delete(provider.name)
      })
      this.configurations.set(provider.name, configuration)
    }
    return configuration
  }

  private getProvider(name: string) {
    const provider = this.providers.get(name)
    if (!provider) {
      throw new BadRequestException(`Unknown OIDC provider "${name}"`)
    }
    return provider
  }

  /**
   * Start a login, returning the identity provider URL to redirect the user to
   * @param redirectUri - Where to send the user (with a token) once login
   * completes
   */
  async startLogin(name: string, req: Request, redirectUri?: string) {
    if (!redirectUri) {
      throw new BadRequestException('No redirect_uri provided')
    }
    const provider = this.getProvider(name)
    const config = await this.getConfiguration(provider)
    const codeVerifier = client.randomPKCECodeVerifier()
    const loginState: OidcLoginState = {
      state: client.randomState(),
      nonce: client.randomNonce(),
      codeVerifier,
      redirectUri,
    }
    req.session.oidc = { ...req.session.oidc, [name]: loginState }
    return client.buildAuthorizationUrl(config, {
      redirect_uri: this.getCallbackURL(name).href,
      scope: provider.scopes,
      state: loginState.state,
      nonce: loginState.nonce,
      code_challenge: await client.calculatePKCECodeChallenge(codeVerifier),
      code_challenge_method: 'S256',
    }).href
  }

  /**
   * Handle the identity provider's redirect back to the server
   * @returns The user's name and email and where to send the user next
   */
  async finishLogin(name: string, req: Request) {
    const provider = this.getProvider(name)
    const loginState = req.session.oidc?.[name]
    if (!loginState) {
      throw new UnauthorizedException(
        'No login in progress, or login session expired',
      )
    }
    delete req.session.oidc?.[name]
    const config = await this.getConfiguration(provider)
    const currentURL = this.getCallbackURL(name)
    currentURL.search = new URL(req.originalUrl, currentURL).search
    let tokens: Awaited<ReturnType<typeof client.authorizationCodeGrant>>
    try {
      tokens = await client.authorizationCodeGrant(config, currentURL, {
        expectedState: loginState.state,
        expectedNonce: loginState.nonce,
        pkceCodeVerifier: loginState.codeVerifier,
      })
    } catch (error) {
      let message = error instanceof Error ? error.message : 'Login failed'
      // Errors returned by the identity provider, e.g. "invalid_grant"
      if (
        error instanceof client.ResponseBodyError ||
        error instanceof client.AuthorizationResponseError
      ) {
        message = `${message}: ${error.error}${
          error.error_description ? ` (${error.error_description})` : ''
        }`
      }
      this.logger.warn(`OIDC login with "${name}" failed: ${message}`)
      throw new UnauthorizedException(message)
    }
    let claims: Record<string, unknown> = tokens.claims() ?? {}
    if (typeof claims.email !== 'string' && claims.sub) {
      const userInfo = await client.fetchUserInfo(
        config,
        tokens.access_token,
        claims.sub as string,
      )
      claims = { ...userInfo, ...claims }
    }
    let { email } = claims
    // Microsoft accounts don't always have an email claim, but their
    // preferred_username is the account's email address
    if (typeof email !== 'string' && name === 'microsoft') {
      email = claims.preferred_username
    }
    if (typeof email !== 'string' || !email) {
      throw new UnauthorizedException('No email provided')
    }
    // Users are matched by email, so don't trust an email the provider says it
    // hasn't verified
    if (claims.email_verified === false) {
      throw new UnauthorizedException('Email address has not been verified')
    }
    const userName = typeof claims.name === 'string' ? claims.name : email
    return { name: userName, email, redirectUri: loginState.redirectUri }
  }
}
