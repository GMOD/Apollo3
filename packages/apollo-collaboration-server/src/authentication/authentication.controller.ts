import { Controller, Post, Request, UseGuards } from '@nestjs/common'

import { LocalAuthGuard } from '../utils/local-auth.guard'
import { AuthenticationService } from './authentication.service'

@Controller('auth')
export class AuthenticationController {
  constructor(private readonly authService: AuthenticationService) {}

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
