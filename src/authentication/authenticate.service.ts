import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { UsersService } from '../usersDemo/users.service';
import { JwtService } from '@nestjs/jwt';
import { Response } from 'express';


@Injectable()
export class AuthenticateService {
  private readonly logger = new Logger(AuthenticateService.name);
  
    constructor(
        private readonly usersService: UsersService,
        private readonly jwtService: JwtService,
      ) {}
    
      /**
       * Validates username and password. THIS IS JUST FOR DEMO PURPOSE
       * @param username Username
       * @param pass Password
       * @returns User or null
       */
      async validateUser(username: string, pass: string): Promise<any> {
        // Check against hard-coded list of users
        const user = await this.usersService.findOne(username);
        if (user && user.password === pass) {
          const { password, ...result } = user;
          return result;
        }
        return null;
      }
    

      /**
       * Check user's login attempt. THIS IS JUST FOR DEMO PURPOSE!
       * @param user username
       * @param response Incoming httpresponse
       * @returns Return either token with HttpResponse status 'HttpStatus.OK' OR null with 'HttpStatus.UNAUTHORIZED'
       */
      async login(user: any, response: Response): Promise<Response>  {        
        const payload = { username: user.username, sub: user.userId };
        // Return token with SUCCESS status
        let returnToken = this.jwtService.sign(payload);
        this.logger.debug('Login successful. Issued token: ' + JSON.stringify(returnToken));
        return await response.status(HttpStatus.OK).json(returnToken);        
        // Return FAILED status with no token
        // this.logger.error('Login refused');
        // return response.status(HttpStatus.UNAUTHORIZED).json();
      }    
}
