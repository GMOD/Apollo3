import { Controller, Get, Param, Post, Request, Res, UseGuards } from '@nestjs/common';
import { UserService } from './user.service';
import { JwtAuthGuard } from './../utils/jwt-auth.guard';
import { Response } from 'express';
import { getCustomRepository, getManager } from 'typeorm';
import { GrailsUserRepository } from '../repositories/GrailsUserRepository';

@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  // QUESTION: SHOULD WE USE ASYNC/WAIT OR NOT?
  // @UseGuards(JwtAuthGuard)
  // @Get('/usernames')
  // async getAllUsers2(@Res() response: Response) {
  //   return await this.userService.getAllUsernames(response);
  // }

    // Get all users from database using pure ORM
    @UseGuards(JwtAuthGuard)
    @Get('/all')
    async getAllUsersOrm(@Res() response: Response) {
      return await this.userService.getAllUsersORM(response);
    }
  
    // Get usernames from database using embedded SQL in customs repository
    @UseGuards(JwtAuthGuard)
    @Get('/usernames')
    async getAllUsers2(@Res() response: Response) {
      return await getCustomRepository(GrailsUserRepository).getAllUsernames(response);
    }
    
    // Get user by lastname using customized ORM in customs repository
    @UseGuards(JwtAuthGuard)
    @Get(':lastname')
    async getByLastname(@Param('lastname') lastname: string, @Res() response: Response) {
      return await getCustomRepository(GrailsUserRepository).findByLastName(lastname, response);
     }
}