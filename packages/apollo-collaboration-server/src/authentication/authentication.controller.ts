import { Controller, Post, Req, UseGuards } from '@nestjs/common'
import { Request } from 'express'

import { User } from '../users/users.service'
import { LocalAuthGuard } from '../utils/local-auth.guard'
import { AuthenticationService } from './authentication.service'

interface RequestWithValidatedUser extends Request {
  user: Omit<User, 'password'>
}

@Controller('auth')
export class AuthenticationController {
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
}
