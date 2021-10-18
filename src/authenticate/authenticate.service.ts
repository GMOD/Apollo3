import { HttpStatus, Injectable } from '@nestjs/common';
import { UsersService } from '../usersDemo/users.service';
import { JwtService } from '@nestjs/jwt';
import { Response } from 'express';

@Injectable()
export class AuthenticateService {
    constructor(
        private readonly usersService: UsersService,
        private readonly jwtService: JwtService,
      ) {}
    
      async validateUser(username: string, pass: string): Promise<any> {
        const user = await this.usersService.findOne(username);
        if (user && user.password === pass) {
          const { password, ...result } = user;
          return result;
        }
        return null;
      }
    
      // Validate username and password
      async login(user: any, response: Response): Promise<Response>  {
        const payload = { username: user.username, sub: user.userId };
        // Return token with SUCCESS status
        return await response.status(HttpStatus.OK).json(this.jwtService.sign(payload));        
        // Return FAILED status with no token
        // return response.status(HttpStatus.UNAUTHORIZED).json();
      }    
}
