import fs from 'node:fs/promises'

import type {
  AuthHandlerRedirect,
  AuthHandlerUser,
} from '@apollo-annotation/common/server'
import type { DecodedJWT, JWTPayload } from '@apollo-annotation/shared'
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { JwtService } from '@nestjs/jwt'
import type { Request, Response } from 'express'

import { PluginsService } from '../plugins/plugins.service.js'
import { CreateUserDto } from '../users/dto/create-user.dto.js'
import {
  UsersService,
  isPendingUser,
  normalizeEmail,
} from '../users/users.service.js'
import {
  GUEST_USER_EMAIL,
  GUEST_USER_NAME,
  ROOT_USER_EMAIL,
  ROOT_USER_NAME,
} from '../utils/constants.js'
import { Role } from '../utils/role/role.enum.js'

import { OidcService } from './oidc/oidc.service.js'

/**
 * Result of an OAuth login. If the user was authenticated but is not allowed
 * to log in, `error` is sent back to the client in the redirect instead of a
 * token.
 */
export type OAuthLoginResult = { token: string } | { error: string }

interface ConfigValues {
  URL: string
  ALLOWED_REDIRECT_ORIGINS?: string
  ALLOW_GUEST_USER: boolean
  ALLOW_ROOT_USER: boolean
  DEFAULT_NEW_USER_ROLE: Role
  ROOT_USER_PASSWORD?: string
  ROOT_USER_PASSWORD_FILE?: string
  INITIAL_ADMIN_EMAIL?: string
  ONLY_ALLOW_APPROVED_USERS: boolean
}

const LOOPBACK_HOSTNAMES = new Set(['localhost', '127.0.0.1', '[::1]'])

@Injectable()
export class AuthenticationService {
  private readonly logger = new Logger(AuthenticationService.name)
  private defaultNewUserRole: Role
  private readonly allowedRedirectOrigins: Set<string>

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService<ConfigValues, true>,
    private readonly pluginsService: PluginsService,
    private readonly oidcService: OidcService,
  ) {
    this.defaultNewUserRole = configService.get('DEFAULT_NEW_USER_ROLE', {
      infer: true,
    })
    this.allowedRedirectOrigins = new Set(
      (configService.get('ALLOWED_REDIRECT_ORIGINS', { infer: true }) ?? '')
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean)
        .map((origin) => new URL(origin).origin),
    )
    this.allowedRedirectOrigins.add(
      new URL(configService.get('URL', { infer: true })).origin,
    )
  }

  /**
   * Make sure a login redirect URI is somewhere we trust with the user's
   * token: Apollo itself, an origin in ALLOWED_REDIRECT_ORIGINS, or this
   * computer (e.g. JBrowse Desktop or a local development server)
   */
  assertAllowedRedirectUri(redirectUri: string) {
    let url: URL
    try {
      url = new URL(redirectUri)
    } catch {
      throw new BadRequestException(`Invalid redirect_uri "${redirectUri}"`)
    }
    const isLoopback =
      (url.protocol === 'http:' || url.protocol === 'https:') &&
      LOOPBACK_HOSTNAMES.has(url.hostname)
    if (!isLoopback && !this.allowedRedirectOrigins.has(url.origin)) {
      throw new BadRequestException(
        `redirect_uri origin "${url.origin}" is not allowed, add it to ALLOWED_REDIRECT_ORIGINS to allow it`,
      )
    }
  }

  /**
   * Run a login from an OAuth redirect, returning login denials as an error
   * so they can be passed back to the client instead of showing a raw error
   * page in the login popup
   */
  async oauthLogIn(name: string, email: string): Promise<OAuthLoginResult> {
    try {
      return await this.logIn(name, email)
    } catch (error) {
      if (error instanceof ForbiddenException) {
        return { error: error.message }
      }
      throw error
    }
  }

  /**
   * Get the URL to send the user to after logging in, with their token added
   */
  getTokenRedirectUrl(redirectUri: string, token: string) {
    return this.getLoginRedirectUrl(redirectUri, { token })
  }

  /**
   * Get the URL to send the user to after logging in, with their token or
   * login error added
   */
  getLoginRedirectUrl(redirectUri: string, result: OAuthLoginResult) {
    this.assertAllowedRedirectUri(redirectUri)
    const url = new URL(redirectUri)
    const searchParams = new URLSearchParams(
      'token' in result
        ? { access_token: result.token }
        : { error: result.error },
    )
    url.search = searchParams.toString()
    return url.toString()
  }

  getLoginTypes() {
    const customAuthTypes = this.pluginsService.getCustomAuthHandlers()
    const loginTypes: { name: string; needsPopup: boolean; message: string }[] =
      []
    for (const [name, { needsPopup, message }] of customAuthTypes) {
      if (this.oidcService.has(name)) {
        this.logger.warn(
          `Custom login type "${name}" is ignored because an OIDC provider with the same name is configured`,
        )
        continue
      }
      loginTypes.push({ name, message, needsPopup })
    }
    for (const { name, displayName } of this.oidcService.list()) {
      loginTypes.push({
        name,
        message: `Sign in with ${displayName}`,
        needsPopup: true,
      })
    }
    const allowGuestUser = this.configService.get('ALLOW_GUEST_USER', {
      infer: true,
    })
    if (allowGuestUser) {
      loginTypes.push({
        name: 'guest',
        message: 'Continue as Guest',
        needsPopup: false,
      })
    }
    return loginTypes
  }

  /**
   * Log in as a guest
   * @returns Return either token with HttpResponse status 'HttpStatus.OK' OR null with 'HttpStatus.UNAUTHORIZED'
   */
  async guestLogin() {
    const allowGuestUser = this.configService.get('ALLOW_GUEST_USER', {
      infer: true,
    })
    if (allowGuestUser) {
      return this.logIn(GUEST_USER_NAME, GUEST_USER_EMAIL)
    }
    throw new UnauthorizedException('Guest users are not allowed')
  }

  async fallbackLogin(
    id: string,
    request: Request,
    response: Response,
    redirectUri?: string,
    state?: string,
  ) {
    const customAuthTypes = this.pluginsService.getCustomAuthHandlers()
    const customAuth = customAuthTypes.get(id)
    if (!customAuth) {
      throw new UnauthorizedException('Unknown authentication type')
    }
    let result: AuthHandlerRedirect | AuthHandlerUser
    try {
      result = await customAuth.handler(request, redirectUri)
    } catch (error) {
      throw new UnauthorizedException(error)
    }
    if ('url' in result) {
      response.redirect(result.url)
      return result
    }
    if ('name' in result && 'email' in result) {
      if (customAuth.needsPopup && state) {
        const logInResult = await this.oauthLogIn(result.name, result.email)
        const { redirect_uri } = JSON.parse(state) as { redirect_uri: string }
        response.redirect(this.getLoginRedirectUrl(redirect_uri, logInResult))
        return logInResult
      }
      return this.logIn(result.name, result.email)
    }
    throw new UnauthorizedException('Malformed authentication handler response')
  }

  async rootLogin(password: string) {
    const allowRootUser = this.configService.get('ALLOW_ROOT_USER', {
      infer: true,
    })
    if (!allowRootUser) {
      throw new UnauthorizedException('Root user is not allowed')
    }
    let rootUserPassword = this.configService.get('ROOT_USER_PASSWORD', {
      infer: true,
    })
    if (!rootUserPassword) {
      const passwordFile = this.configService.get('ROOT_USER_PASSWORD_FILE', {
        infer: true,
      })
      rootUserPassword =
        passwordFile && (await fs.readFile(passwordFile, 'utf8'))
      rootUserPassword = rootUserPassword?.trim()
    }
    if (!rootUserPassword) {
      this.logger.error(
        'ALLOW_ROOT_USER is true, but no ROOT_USER_PASSWORD or ROOT_USER_PASSWORD_FILE was provided',
      )
      throw new UnauthorizedException('Root user is not configured')
    }
    if (password === rootUserPassword) {
      return this.logIn(ROOT_USER_NAME, ROOT_USER_EMAIL)
    }
    throw new UnauthorizedException('Invalid password for ROOT user')
  }

  /**
   * Log in, creating the user if this is their first time logging in
   * @param name - User's display name
   * @param email - User's email
   * @returns Return token with HttpResponse status 'HttpStatus.OK'
   * @throws ForbiddenException if the user is not allowed to log in
   */
  async logIn(name: string, email: string) {
    const isRootUser = name === ROOT_USER_NAME && email === ROOT_USER_EMAIL
    if (!isRootUser) {
      await this.checkInitialAdminHasLoggedIn(email)
    }
    // Find user from Mongo
    let user = await this.usersService.findByEmail(email)
    if (!user) {
      const onlyAllowApprovedUsers = this.configService.get(
        'ONLY_ALLOW_APPROVED_USERS',
        { infer: true },
      )
      if (onlyAllowApprovedUsers && !isRootUser) {
        this.logger.log(`Login denied for unapproved user (${email})`)
        throw new ForbiddenException(
          `${email} has not been approved to use this Apollo server. Please contact an administrator.`,
        )
      }
      const newUser: CreateUserDto = {
        email,
        username: name,
        role: isRootUser ? Role.Admin : await this.getNewUserRole(),
      }
      this.logger.log(
        `First time login for "${newUser.username}" (${newUser.email})`,
      )
      user = await this.usersService.addNew(newUser)
    } else if (isPendingUser(user)) {
      this.logger.log(`First time login for pre-approved "${name}" (${email})`)
      user =
        (await this.usersService.completePendingUser(
          user._id.toString(),
          name,
        )) ?? user
    }
    this.logger.debug(`User found in Mongo: ${JSON.stringify(user)}`)

    const payload: JWTPayload = {
      username: user.username ?? name,
      email: user.email,
      role: user.role,
      id: user.id,
    }
    // Return token with SUCCESS status
    const returnToken = this.jwtService.sign(payload)
    this.logger.debug(`User "${payload.username}" has logged in`)
    return { token: returnToken }
  }

  /**
   * Issue a new token with the user's current role, so a user whose role has
   * changed (e.g. an admin gave them access) doesn't have to log in again. The
   * new token expires when the old one would have, so refreshing can't keep a
   * login alive forever.
   * @param user - The user from the request's (already verified) token
   */
  async refreshToken(user: Partial<DecodedJWT>) {
    const { exp, id } = user
    if (!id || !exp) {
      throw new UnauthorizedException('Not logged in')
    }
    const currentUser = await this.usersService.findById(id)
    if (!currentUser) {
      throw new UnauthorizedException('User no longer exists')
    }
    const payload: JWTPayload = {
      username: currentUser.username ?? user.username ?? '',
      email: currentUser.email,
      role: currentUser.role,
      id: currentUser.id,
    }
    const expiresIn = exp - Math.floor(Date.now() / 1000)
    return { token: this.jwtService.sign(payload, { expiresIn }) }
  }

  /**
   * If INITIAL_ADMIN_EMAIL is set, nobody else can log in until that user has
   * logged in for the first time
   */
  private async checkInitialAdminHasLoggedIn(email: string) {
    const initialAdminEmail = this.configService.get('INITIAL_ADMIN_EMAIL', {
      infer: true,
    })
    if (
      !initialAdminEmail ||
      normalizeEmail(email) === normalizeEmail(initialAdminEmail)
    ) {
      return
    }
    const initialAdmin = await this.usersService.findByEmail(initialAdminEmail)
    if (!initialAdmin || isPendingUser(initialAdmin)) {
      this.logger.log(
        `Login denied for ${email}, initial admin has not logged in yet`,
      )
      throw new ForbiddenException(
        'This Apollo server is waiting for its administrator to log in for the first time. Please try again later.',
      )
    }
  }

  /**
   * If INITIAL_ADMIN_EMAIL is not set and there is not a non-guest and
   * non-root admin yet, the 1st user to log in will be made an admin.
   * Otherwise new users get the default role.
   */
  private async getNewUserRole() {
    const initialAdminEmail = this.configService.get('INITIAL_ADMIN_EMAIL', {
      infer: true,
    })
    if (initialAdminEmail || (await this.usersService.hasActiveAdmin())) {
      return this.defaultNewUserRole
    }
    return Role.Admin
  }
}
