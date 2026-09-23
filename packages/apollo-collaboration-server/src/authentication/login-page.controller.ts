import type { DecodedJWT } from '@apollo-annotation/shared'
import { Controller, Get, Header, Query, Req, Res } from '@nestjs/common'
import type { Request, Response } from 'express'

import { clearAuthCookie } from '../utils/auth-cookie.util.js'
import { Role } from '../utils/role/role.enum.js'
import { Validations } from '../utils/validation/validatation.decorator.js'

import { AuthenticationService } from './authentication.service.js'
import { renderLoginPage } from './login-page.template.js'

@Validations(Role.None)
@Controller()
export class LoginPageController {
  constructor(private readonly authService: AuthenticationService) {}

  @Get('login')
  @Header('Content-Type', 'text/html; charset=utf-8')
  async loginPage(
    @Req() request: Request,
    @Query('redirect_uri') redirectUri?: string,
  ): Promise<string> {
    const loginTypes = await this.authService.getLoginTypes()
    // Must be an absolute path (not a bare relative segment): this value is
    // threaded through OAuth as `redirect_uri` and echoed back from routes
    // nested under `/auth/...`, where a relative "login" would resolve
    // against the wrong directory (e.g. to `/auth/login` instead of
    // `/login`).
    const target = redirectUri ?? '/login'
    const { user } = request as unknown as { user?: Partial<DecodedJWT> }
    const loggedInUser =
      // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison
      user?.username && user.role && user.role !== Role.None
        ? { username: user.username, role: user.role }
        : undefined
    return renderLoginPage({ loginTypes, redirectUri: target, loggedInUser })
  }

  @Get('logout')
  logout(
    @Res() res: Response,
    @Query('redirect_uri') redirectUri?: string,
  ): void {
    clearAuthCookie(res)
    res.redirect(redirectUri ?? 'login')
  }
}
