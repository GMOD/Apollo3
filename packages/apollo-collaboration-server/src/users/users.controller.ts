import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common'
import { Request } from 'express'

import { JwtAuthGuard } from '../utils/jwt-auth.guard'
import { Role } from '../utils/role/role.enum'
import { Validations } from '../utils/validation/validatation.decorator'
import { UserLocationDto } from './dto/create-user.dto'
import { UsersService } from './users.service'

@UseGuards(JwtAuthGuard)
@Validations(Role.ReadOnly)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  findAll() {
    console.log('FIND ALL')
    return this.usersService.findAll()
  }

  /**
   * Get the oldest (in terms of creation date) admin email address. This is needed when user has logged in and he needs to email to admin to get role
   * User who is calling this endpoint does not have any role yet and therefore there can not be 'Role' -validation
   * @returns The oldest (in terms of creation date) admin email address.
   */
  @Get('admin')
  findAdmin() {
    console.log('FIND ADMIN')
    return this.usersService.findByRole('admin')
  }

  /**
   * Receives user location by broadcasting 'user location' -request using web sockets
   * @param userLocation - user's location information
   * @returns
   */
  @Get('locations')
  usesrLocations(@Req() req: Request) {
    const { authorization } = req.headers
    if (!authorization) {
      throw new Error('No "authorization" header')
    }
    const [, token] = authorization.split(' ')
    return this.usersService.requestUsersLocations(token)
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.usersService.findById(id)
  }

  /**
   * Receives user location and broadcast information using web sockets
   * @param userLocation - user's location information
   * @returns
   */
  @Post('userLocation')
  userLocation(@Body() userLocation: UserLocationDto, @Req() req: Request) {
    const { authorization } = req.headers
    if (!authorization) {
      throw new Error('No "authorization" header')
    }
    const [, token] = authorization.split(' ')
    return this.usersService.broadcastLocation(userLocation, token)
  }
}
