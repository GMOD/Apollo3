import {
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
import { OidcService } from './oidc/oidc.service.js'

@Validations(Role.None)
@Controller('auth')
export class AuthenticationController {
  constructor(
    private readonly authService: AuthenticationService,
    private readonly oidcService: OidcService,
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

  @Get(':id')
  async fallbackLogin(
    @Param('id') id: string,
    @Req() req: Request,
    @Res() res: Response,
    @Query('redirect_uri') redirectUri?: string,
    @Query('state') state?: string,
  ) {
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
