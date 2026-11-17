import { randomBytes, timingSafeEqual } from 'node:crypto'

import type { DecodedJWT } from '@apollo-annotation/shared'
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Redirect,
  Req,
  Res,
} from '@nestjs/common'
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiExcludeEndpoint,
  ApiFoundResponse,
  ApiOkResponse,
  ApiQuery,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger'
import type { Request, Response } from 'express'

import { Role } from '../utils/role/role.enum.js'
import { Validations } from '../utils/validation/validatation.decorator.js'

import { AuthenticationService } from './authentication.service.js'
import {
  DeviceLoginService,
  formatUserCode,
} from './device/device-login.service.js'
import {
  renderCompletePage,
  renderConfirmPage,
  renderEnterCodePage,
  renderErrorPage,
} from './device/device-pages.js'
import {
  DeviceLoginStartResponse,
  DeviceLoginTokenDto,
  RootLoginDto,
  StartDeviceLoginDto,
  TokenResponse,
} from './dto/login.dto.js'
import { OidcService } from './oidc/oidc.service.js'

declare module 'express-session' {
  interface SessionData {
    deviceLogin?: { csrf: string; userCode?: string }
  }
}

function safeEqual(a: string, b: string) {
  const bufferA = Buffer.from(a)
  const bufferB = Buffer.from(b)
  return bufferA.length === bufferB.length && timingSafeEqual(bufferA, bufferB)
}

/**
 * The only OIDC prompt the client may ask for: "select_account", so a user
 * switching accounts gets to choose one instead of being logged straight back
 * in to the one they're already signed in to with the identity provider
 */
function assertAllowedPrompt(
  prompt?: string,
): asserts prompt is 'select_account' | undefined {
  if (prompt !== undefined && prompt !== 'select_account') {
    throw new BadRequestException(`Unsupported prompt "${prompt}"`)
  }
}

@Validations(Role.None)
@Controller('auth')
export class AuthenticationController {
  constructor(
    private readonly authService: AuthenticationService,
    private readonly oidcService: OidcService,
    private readonly deviceLoginService: DeviceLoginService,
  ) {}

  /** List the ways users can log in to this server */
  @Get('types')
  getLoginTypes() {
    return this.authService.getLoginTypes()
  }

  /**
   * Start a browser login
   *
   * Redirects to `/auth/{type}`, which redirects to the identity provider.
   * After the user logs in, the browser is redirected to `redirect_uri` with
   * an `access_token` (or an `error`) query parameter.
   * @param type - Login type, one of the names from `GET /auth/types`
   */
  @ApiQuery({
    name: 'redirect_uri',
    required: false,
    description:
      'Where to send the user after logging in. Must be on this server, on localhost, or on an origin in ALLOWED_REDIRECT_ORIGINS.',
  })
  @ApiQuery({
    name: 'prompt',
    required: false,
    enum: ['select_account'],
    description:
      'Set to `select_account` to let the user pick a different account at the identity provider',
  })
  @ApiFoundResponse({ description: 'Redirect to the login type' })
  @Get('login')
  @Redirect()
  handleLogin(
    @Query('type') type: string,
    @Query('redirect_uri') redirect_uri?: string,
    @Query('prompt') prompt?: string,
  ) {
    if (redirect_uri) {
      this.authService.assertAllowedRedirectUri(redirect_uri)
    }
    assertAllowedPrompt(prompt)
    const params = new URLSearchParams()
    if (redirect_uri) {
      params.set('redirect_uri', redirect_uri)
    }
    if (prompt) {
      params.set('prompt', prompt)
    }
    const url = params.size > 0 ? `${type}?${params.toString()}` : type
    return { url }
  }

  /**
   * Get a new token with the user's current role
   *
   * Send the current token. Use this after a user's role changes so they
   * don't have to log in again. The new token expires when the current one
   * would have.
   */
  @ApiBearerAuth()
  @ApiCreatedResponse({ type: TokenResponse })
  @ApiUnauthorizedResponse({ description: 'No valid token was sent' })
  @Post('refresh')
  refreshToken(@Req() req: Request) {
    return this.authService.refreshToken(req.user as Partial<DecodedJWT>)
  }

  /** Log in as the guest user, if the server allows guests */
  @ApiOkResponse({ type: TokenResponse })
  @ApiUnauthorizedResponse({ description: "The server doesn't allow guests" })
  @Get('guest')
  guestLogin() {
    return this.authService.guestLogin()
  }

  /** Log in as the root user, if the server allows it */
  @ApiCreatedResponse({ type: TokenResponse })
  @ApiUnauthorizedResponse({
    description: "Wrong password, or the server doesn't allow the root user",
  })
  @Post('root')
  rootLogin(@Body() { password }: RootLoginDto) {
    return this.authService.rootLogin(password)
  }

  /**
   * Start a device login
   *
   * For clients that can't open a browser themselves, such as the CLI. Show
   * the user `verification_uri` and `user_code` (or `verification_uri_complete`),
   * then poll `POST /auth/device/token` every `interval` seconds.
   */
  @ApiCreatedResponse({ type: DeviceLoginStartResponse })
  @ApiBadRequestResponse({ description: 'No login type was given' })
  @Post('device')
  startDeviceLogin(@Body() { type }: StartDeviceLoginDto) {
    if (!type) {
      throw new BadRequestException('No login type provided')
    }
    return this.deviceLoginService.create(type)
  }

  /**
   * Get the token for a device login
   *
   * Poll this until the user has logged in. Until then it responds with status
   * 400 and an `error` of `authorization_pending`, or `slow_down` if polled
   * too often. An `error` of `expired_token` means the login has expired.
   */
  @ApiCreatedResponse({ type: TokenResponse })
  @ApiBadRequestResponse({
    description: "The login isn't finished, or has expired",
    schema: {
      type: 'object',
      properties: {
        error: {
          type: 'string',
          enum: ['authorization_pending', 'slow_down', 'expired_token'],
        },
      },
    },
  })
  @Post('device/token')
  async getDeviceLoginToken(
    @Body() { device_code }: DeviceLoginTokenDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    if (!device_code) {
      throw new BadRequestException('No device_code provided')
    }
    const result = await this.deviceLoginService.poll(device_code)
    // Errors are part of normal polling, so respond with them directly instead
    // of throwing, which would log a warning on every poll
    if ('error' in result) {
      res.status(400)
    }
    return result
  }

  /** Page where the user enters or confirms the device's code */
  @ApiExcludeEndpoint()
  @Get('device')
  async deviceLoginPage(
    @Req() req: Request,
    @Res() res: Response,
    @Query('user_code') userCode?: string,
  ) {
    res.type('html')
    const pageURL = this.deviceLoginService.getURL().href
    if (!userCode) {
      res.send(renderEnterCodePage(pageURL))
      return
    }
    const deviceLogin = await this.deviceLoginService.findPending(userCode)
    if (!deviceLogin) {
      res
        .status(404)
        .send(renderEnterCodePage(pageURL, 'Invalid or expired code'))
      return
    }
    const csrf = randomBytes(32).toString('base64url')
    req.session.deviceLogin = { csrf }
    res.send(
      renderConfirmPage(
        this.deviceLoginService.getURL('confirm').href,
        formatUserCode(deviceLogin.userCode),
        csrf,
      ),
    )
  }

  /** The user confirmed the code, so start the login with the device's type */
  @ApiExcludeEndpoint()
  @Post('device/confirm')
  async confirmDeviceLogin(
    @Req() req: Request,
    @Res() res: Response,
    @Body() { user_code, csrf }: { user_code?: string; csrf?: string },
  ) {
    const pageURL = this.deviceLoginService.getURL().href
    const sessionCsrf = req.session.deviceLogin?.csrf
    if (!sessionCsrf || !csrf || !safeEqual(sessionCsrf, csrf)) {
      res
        .status(403)
        .type('html')
        .send(renderErrorPage('Login session expired', pageURL))
      return
    }
    const deviceLogin = user_code
      ? await this.deviceLoginService.findPending(user_code)
      : undefined
    if (!deviceLogin) {
      res
        .status(404)
        .type('html')
        .send(renderErrorPage('Invalid or expired code', pageURL))
      return
    }
    req.session.deviceLogin = {
      csrf: sessionCsrf,
      userCode: deviceLogin.userCode,
    }
    const loginURL = new URL('login', this.deviceLoginService.getURL())
    loginURL.search = new URLSearchParams({
      type: deviceLogin.type,
      redirect_uri: this.deviceLoginService.getURL('complete').href,
    }).toString()
    res.redirect(303, loginURL.href)
  }

  /** Where the login redirects with the user's token once they've logged in */
  @ApiExcludeEndpoint()
  @Get('device/complete')
  async completeDeviceLogin(
    @Req() req: Request,
    @Res() res: Response,
    @Query('access_token') token?: string,
    @Query('error') error?: string,
  ) {
    res.type('html')
    const userCode = req.session.deviceLogin?.userCode
    delete req.session.deviceLogin
    // The user logged in but isn't allowed to use Apollo, so trying again
    // won't help
    if (error) {
      res.status(403).send(renderErrorPage(error))
      return
    }
    const approved =
      userCode && token
        ? await this.deviceLoginService.approve(userCode, token)
        : false
    if (!approved) {
      res
        .status(400)
        .send(
          renderErrorPage(
            'Login session or code expired',
            this.deviceLoginService.getURL().href,
          ),
        )
      return
    }
    res.send(renderCompletePage())
  }

  /**
   * Log in with a login type
   *
   * For browser logins, this is where `GET /auth/login` redirects to, and
   * where the identity provider redirects back to. Some login types added by
   * plugins respond with a token directly instead.
   * @param id - Login type, one of the names from `GET /auth/types`
   */
  @ApiQuery({
    name: 'redirect_uri',
    required: false,
    description: 'Where to send the user after logging in',
  })
  @ApiQuery({
    name: 'state',
    required: false,
    description:
      'Login state passed back by the identity provider or by a login type from a plugin',
  })
  @ApiQuery({
    name: 'prompt',
    required: false,
    enum: ['select_account'],
    description:
      'Set to `select_account` to let the user pick a different account at the identity provider',
  })
  @Get(':id')
  async fallbackLogin(
    @Param('id') id: string,
    @Req() req: Request,
    @Res() res: Response,
    @Query('redirect_uri') redirectUri?: string,
    @Query('state') state?: string,
    @Query('prompt') prompt?: string,
  ) {
    if (redirectUri) {
      this.authService.assertAllowedRedirectUri(redirectUri)
    }
    if (this.oidcService.has(id)) {
      // The identity provider redirects back here with either a code or an
      // error, otherwise this is the start of the login
      if ('code' in req.query || 'error' in req.query) {
        const { name, email, redirectUri } = await this.oidcService.finishLogin(
          id,
          req,
        )
        const result = await this.authService.oauthLogIn(name, email)
        res.redirect(this.authService.getLoginRedirectUrl(redirectUri, result))
        return
      }
      // Only check the prompt here: identity providers add their own "prompt"
      // when redirecting back (e.g. Google sends "prompt=none"), and that one
      // isn't ours
      assertAllowedPrompt(prompt)
      res.redirect(
        await this.oidcService.startLogin(id, req, redirectUri, prompt),
      )
      return
    }
    const result = await this.authService.fallbackLogin(
      id,
      req,
      res,
      redirectUri,
      state,
    )
    if (!res.headersSent) {
      res.json(result)
    }
  }
}
