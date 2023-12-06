import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Logger,
  Post,
  Query,
  Redirect,
  Req,
  UseGuards,
} from '@nestjs/common'

import { GoogleAuthGuard } from '../utils/google.guard'
import { Public } from '../utils/jwt-auth.guard'
import { MicrosoftAuthGuard } from '../utils/microsoft.guard'
import {
  AuthenticationService,
  RequestWithUserToken,
} from './authentication.service'

@Public()
@Controller('auth')
export class AuthenticationController {
  private readonly logger = new Logger(AuthenticationController.name)

  constructor(private readonly authService: AuthenticationService) {}

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
    const params = new URLSearchParams({ type })
    if (redirect_uri) {
      params.set('redirect_uri', redirect_uri)
    }
    if (['google', 'microsoft', 'guest', 'root'].includes(type)) {
      const url = redirect_uri
        ? `${type}?${new URLSearchParams({ redirect_uri }).toString()}`
        : type
      return { url }
    }
    throw new BadRequestException(`Unknown login type "${type}"`)
  }

  @Get('google')
  @Redirect()
  @UseGuards(GoogleAuthGuard)
  async handleRedirect(@Req() req: RequestWithUserToken) {
    return this.authService.handleRedirect(req)
  }

  @Get('microsoft')
  @Redirect()
  @UseGuards(MicrosoftAuthGuard)
  async microsoftHandleRedirect(@Req() req: RequestWithUserToken) {
    return this.authService.handleRedirect(req)
  }

  @Get('guest')
  guestLogin() {
    return this.authService.guestLogin()
  }

  @Post('root')
  rootLogin(
    @Body() { password, username }: { password: string; username: string },
  ) {
    return this.authService.rootLogin(username, password)
  }
}
