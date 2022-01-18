import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common'
import { getCustomRepository } from 'typeorm'

import ApolloUser from '../entity/grails_user.entity'
import { GrailsUserRepository } from '../repository/GrailsUserRepository'
import { JwtAuthGuard } from '../utils/jwt-auth.guard'
import { Roles } from '../utils/role/role.decorator'
import { Role } from '../utils/role/role.enum'
import { UsersService } from './users.service'

@Controller('user')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  /**
   * Get all users from database using pure ORM
   * @returns Return list of users with HttpResponse status 'HttpStatus.OK'
   * or in case of 'No data found' return error message with 'HttpStatus.NOT_FOUND'
   * or in case of error return error message with 'HttpStatus.INTERNAL_SERVER_ERROR'
   */
  @UseGuards(JwtAuthGuard)
  @Roles(Role.User) // This value is for demo only
  @Get('/all')
  async getAllUsersOrm() {
    return this.usersService.getAllUsersORM()
  }

  /**
   * Get usernames from database using embedded SQL in customs repository
   * @returns Return list of usernames with HttpResponse status 'HttpStatus.OK'
   * or in case of 'No data found' return error message with 'HttpStatus.NOT_FOUND'
   * or in case of error return error message with 'HttpStatus.INTERNAL_SERVER_ERROR'
   */
  @UseGuards(JwtAuthGuard)
  @Roles() // Empty value is for demo only
  @Get('/usernames')
  async getAllUsers2() {
    return this.usersService.getAllUsernames()
  }

  /**
   * Get users and their roles
   * @returns Return list of users and their roles with HttpResponse status 'HttpStatus.OK'
   * or in case of 'No data found' return error message with 'HttpStatus.NOT_FOUND'
   * or in case of error return error message with 'HttpStatus.INTERNAL_SERVER_ERROR'
   */
  @UseGuards(JwtAuthGuard)
  @Roles() // Empty value is for demo only
  @Get('/userandroles')
  async getAllUsersAndRoles() {
    return this.usersService.getUsersAndRoles()
  }

  /**
   * Get user by lastname using customized ORM in customs repository
   * @param lastname -
   * @returns Return user with HttpResponse status 'HttpStatus.OK'
   * or in case of 'No data found' return error message with 'HttpStatus.NOT_FOUND'
   * or in case of error return error message with 'HttpStatus.INTERNAL_SERVER_ERROR'
   */
  @UseGuards(JwtAuthGuard)
  @Roles(Role.Admin) // This value is for demo only
  @Get(':lastname')
  async getByLastname(@Param('lastname') lastname: string) {
    return getCustomRepository(GrailsUserRepository).findByLastName(lastname)
  }

  /**
   * Adds new user to database unless the user already exist
   * @param user - User object
   * @returns Return new user object with status 'HttpStatus.OK'
   * or in case of user already exists then return error message with 'HttpStatus.CONFLICT'
   * or in case of error return error message with 'HttpStatus.INTERNAL_SERVER_ERROR'
   */
  @UseGuards(JwtAuthGuard)
  @Roles(Role.Admin)
  @Post()
  async addNewUser(@Body() user: ApolloUser) {
    return this.usersService.addNewUserTypeORMTransaction(user) // Saves data using TypeORM transaction. This is working ok
    // return this.usersService.addNewUser(user, response); // Saves data using TypeScript transaction. This is working ok
  }
}
