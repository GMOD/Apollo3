/* eslint-disable @typescript-eslint/require-await */
import {
  Body,
  Controller,
  Get,
  Logger,
  Param,
  Post,
  Query,
  Redirect,
  Req,
  UseGuards,
} from '@nestjs/common'
import { type Request } from 'express'

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
    const url = redirect_uri
      ? `${type}?${new URLSearchParams({ redirect_uri }).toString()}`
      : type
    return { url }
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

  @Get(':id')
  @Redirect()
  async fallbackLogin(
    @Param('id') id: string,
    @Req() req: Request,
    @Query('redirect_uri') redirectUri: string,
  ) {
    return this.authService.fallbackLogin(id, req, redirectUri)
  }
}
