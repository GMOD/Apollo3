import { Controller, Get, Param, Post, Req, Res, UseGuards } from '@nestjs/common';
import { UserService } from './user.service';
import { JwtAuthGuard } from '../../utils/jwt-auth.guard';
import { Request, Response } from 'express';
import { getCustomRepository } from 'typeorm';
import { GrailsUserRepository } from '../../repository/GrailsUserRepository';
import { Roles } from '../../utils/role/role.decorator';
import { Role } from '../../utils/role/role.enum';

@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

    /**
     * Get all users from database using pure ORM
     * @param response 
     * @returns Return list of users with HttpResponse status 'HttpStatus.OK'
     * or in case of 'No data found' return error message with 'HttpStatus.NOT_FOUND'
     * or in case of error return error message with 'HttpStatus.INTERNAL_SERVER_ERROR'
     */
    @UseGuards(JwtAuthGuard)
    @Roles(Role.User) // This value is for demo only
    @Get('/all')
    async getAllUsersOrm(@Res() response: Response) {
      return this.userService.getAllUsersORM(response);
    }
  
    
    /**
     * Get usernames from database using embedded SQL in customs repository
     * @param response 
     * @returns Return list of usernames with HttpResponse status 'HttpStatus.OK'
     * or in case of 'No data found' return error message with 'HttpStatus.NOT_FOUND'
     * or in case of error return error message with 'HttpStatus.INTERNAL_SERVER_ERROR'
     */
    @UseGuards(JwtAuthGuard)
    @Roles()  // Empty value is for demo only
    @Get('/usernames')
    async getAllUsers2(@Res() response: Response) {
      return getCustomRepository(GrailsUserRepository).getAllUsernames(response);
    }
    
    /**
     * Get user by lastname using customized ORM in customs repository
     * @param lastname 
     * @param response 
     * @returns Return user with HttpResponse status 'HttpStatus.OK'
     * or in case of 'No data found' return error message with 'HttpStatus.NOT_FOUND'
     * or in case of error return error message with 'HttpStatus.INTERNAL_SERVER_ERROR'
     */
    @UseGuards(JwtAuthGuard)
    @Roles(Role.Admin)  // This value is for demo only
    @Get(':lastname')
    async getByLastname(@Param('lastname') lastname: string, @Res() response: Response, @Req() request: Request) {
      return getCustomRepository(GrailsUserRepository).findByLastName(lastname, response);
     }
}