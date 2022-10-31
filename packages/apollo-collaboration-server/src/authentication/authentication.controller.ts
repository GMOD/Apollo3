import {
  BadRequestException,
  Controller,
  Get,
  Injectable,
  Logger,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common'
import { AuthGuard, PassportStrategy } from '@nestjs/passport'
import { Request } from 'express'
import { BearerStrategy } from 'passport-azure-ad'

import { User } from '../users/users.service'
import { AzureADGuard } from '../utils/azure-ad.guard'
import { GoogleAuthGuard } from '../utils/google.guard'
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
  @UseGuards(GoogleAuthGuard)
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  handleLogin() {
    console.log('********** Google Login ************')
  }

  @Get('google/auth')
  @UseGuards(GoogleAuthGuard)
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  authLogin() {
    console.log('********** Google authLogin ************')
  }

  @Get('google/redirect')
  @UseGuards(GoogleAuthGuard)
  async handleRedirect(@Req() req: Request) {
    if (!req.user) {
      throw new BadRequestException()
    }

    this.logger.debug(`Return value: ${JSON.stringify(req.user)}`)
    return req.user
  }

  @Get('azure-ad/login')
  @UseGuards(AzureADGuard)
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  azureADLogin() {
    console.log('********** azureADLogin ************')
  }

  @Post('azure-ad/redirect')
  @UseGuards(AzureADGuard)
  async azureADHandleRedirectPost(@Req() req: Request) {
    console.log('********** azure-ad redirect end-point ************')
    if (!req.user) {
      throw new BadRequestException()
    }
    const tmpObj:any  = req.user
    this.logger.debug(`Return TOKEN: ${JSON.stringify(req.body.id_token)}`)
    this.logger.debug(`Return NAME: ${JSON.stringify(tmpObj._json.name)}`)
    this.logger.debug(`Return USERNAME: ${JSON.stringify(tmpObj._json.preferred_username)}`)
    return req.user
  }}
