import { Controller, Get, HttpStatus, Post, Request, Res, UseGuards } from '@nestjs/common';
import { AuthenticateService } from './authenticate.service';
import { LocalAuthGuard } from './../utils/local-auth.guard';
import { Response } from 'express';

@Controller('auth')
export class AuthenticateController {

    constructor(private readonly authService: AuthenticateService) {}

    // POST: Check user login attempt
    @UseGuards(LocalAuthGuard)
    @Post('login')
    async login(@Request() req, @Res() response: Response): Promise<Response> {
      // Return either token with SUCCESS or Failed without token. 
      return await this.authService.login(req.user, response);
    }
 
}
