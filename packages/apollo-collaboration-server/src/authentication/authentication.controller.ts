import { randomBytes, timingSafeEqual } from 'node:crypto'

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

@Validations(Role.None)
@Controller('auth')
export class AuthenticationController {
  constructor(
    private readonly authService: AuthenticationService,
    private readonly oidcService: OidcService,
    private readonly deviceLoginService: DeviceLoginService,
  ) {}

  @Get('types')
  getLoginTypes() {
    return this.authService.getLoginTypes()
  }

  @Get('login')
  @Redirect()
  handleLogin(
    @Query('type') type: string,
    @Query('redirect_uri') redirect_uri?: string,
  ) {
    if (redirect_uri) {
      this.authService.assertAllowedRedirectUri(redirect_uri)
    }
    const url = redirect_uri
      ? `${type}?${new URLSearchParams({ redirect_uri }).toString()}`
      : type
    return { url }
  }

  @Get('guest')
  guestLogin() {
    return this.authService.guestLogin()
  }

  @Post('root')
  rootLogin(@Body() { password }: { password: string }) {
    return this.authService.rootLogin(password)
  }

  /** Start a login for a device such as the CLI, see DeviceLoginService */
  @Post('device')
  startDeviceLogin(@Body() { type }: { type?: string }) {
    if (!type) {
      throw new BadRequestException('No login type provided')
    }
    return this.deviceLoginService.create(type)
  }

  /** Polled by the device until the user has logged in */
  @Post('device/token')
  async getDeviceLoginToken(
    @Body() { device_code }: { device_code?: string },
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
  @Get('device/complete')
  async completeDeviceLogin(
    @Req() req: Request,
    @Res() res: Response,
    @Query('access_token') token?: string,
  ) {
    res.type('html')
    const userCode = req.session.deviceLogin?.userCode
    delete req.session.deviceLogin
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

  @Get(':id')
  async fallbackLogin(
    @Param('id') id: string,
    @Req() req: Request,
    @Res() res: Response,
    @Query('redirect_uri') redirectUri?: string,
    @Query('state') state?: string,
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
        const { token } = await this.authService.logIn(name, email)
        res.redirect(this.authService.getTokenRedirectUrl(redirectUri, token))
        return
      }
      res.redirect(await this.oidcService.startLogin(id, req, redirectUri))
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
