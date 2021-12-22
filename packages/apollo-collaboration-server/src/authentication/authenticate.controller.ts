import { Controller, Post, Request, UseGuards } from '@nestjs/common'

import { LocalAuthGuard } from '../utils/local-auth.guard'
import { AuthenticateService } from './authenticate.service'

@Controller('auth')
export class AuthenticateController {
  constructor(private readonly authService: AuthenticateService) {}

  /**
   * POST: Checks user's login attempt.
   * @param req - Request containing username and password
   * @param response - Response
   * @returns Return either token with HttpResponse status 'HttpStatus.OK' OR null with 'HttpStatus.UNAUTHORIZED'
   */
  @UseGuards(LocalAuthGuard)
  @Post('login')
  async login(@Request() req) {
    return this.authService.login(req.user)
  }
}
