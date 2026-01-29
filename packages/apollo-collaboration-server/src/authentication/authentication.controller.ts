/* eslint-disable @typescript-eslint/require-await */
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

import { GoogleAuthGuard } from '../utils/google.guard.js'
import { MicrosoftAuthGuard } from '../utils/microsoft.guard.js'
import { Role } from '../utils/role/role.enum.js'
import { Validations } from '../utils/validation/validatation.decorator.js'

import {
  AuthenticationService,
  type RequestWithUserToken,
} from './authentication.service.js'

@Validations(Role.None)
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
    if (['google', 'microsoft', 'guest'].includes(type)) {
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
  rootLogin(@Body() { password }: { password: string }) {
    return this.authService.rootLogin(password)
  }
}
