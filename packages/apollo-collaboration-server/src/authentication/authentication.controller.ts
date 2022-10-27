import {
  BadRequestException,
  Controller,
  Get,
  Logger,
  Redirect,
  Req,
  UseGuards,
} from '@nestjs/common'
import { Request } from 'express'

import { GoogleAuthGuard } from '../utils/google.guard'
import { AuthenticationService } from './authentication.service'

interface RequestWithUserToken extends Request {
  user: { token: string }
}

@Controller('auth')
export class AuthenticationController {
  private readonly logger = new Logger(AuthenticationController.name)

  constructor(private readonly authService: AuthenticationService) {}

  @Get('google')
  @UseGuards(GoogleAuthGuard)
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  authLogin() {}

  @Get('google/redirect')
  @Redirect()
  @UseGuards(GoogleAuthGuard)
  async handleRedirect(@Req() req: RequestWithUserToken) {
    if (!req.user) {
      throw new BadRequestException()
    }

    this.logger.debug(`Return value: ${JSON.stringify(req.user)}`)
    return { url: `http://localhost:3000/?access_token=${req.user.token}` }
  }
}
