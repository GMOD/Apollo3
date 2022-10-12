import { Controller, Get, Logger, Post, Req, UseGuards } from '@nestjs/common'
import { Request } from 'express'

import { User } from '../users/users.service'
import { GooleAuthGuard } from '../utils/google.guard'
import { LocalAuthGuard } from '../utils/local-auth.guard'
import { AuthenticationService } from './authentication.service'

interface RequestWithValidatedUser extends Request {
  user: Omit<User, 'password'>
}

@Controller('auth')
export class AuthenticationController {
  private readonly logger = new Logger(AuthenticationController.name)

  constructor(private readonly authService: AuthenticationService) {}

  /**
   * POST: Checks user's login attempt.
   * @param req - Request containing username and password
   * @returns Return either token with HttpResponse status 'HttpStatus.OK' OR null with 'HttpStatus.UNAUTHORIZED'
   */
  @UseGuards(LocalAuthGuard)
  @Post('login')
  async login(@Req() req: RequestWithValidatedUser) {
    return this.authService.login(req.user)
  }

  @Get('google/login')
  @UseGuards(GooleAuthGuard)
  handleLogin() {
    this.logger.debug('********** LOGIN ALKAA **************')
    return { mesg: 'Google authentication...'}
  }

  @Get('google/redirect')
  @UseGuards(GooleAuthGuard)
  handleRedirect() {
    this.logger.debug('********** REDIRECT ALKAA **************')
    // return this.authService.googleLogin()
  }
}
