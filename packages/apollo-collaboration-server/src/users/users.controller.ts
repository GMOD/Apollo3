import {
  Body,
  Controller,
  Get,
  Logger,
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
  private readonly logger = new Logger(UsersController.name)

  @Get()
  findAll() {
    return this.usersService.findAll()
  }

  /**
   * Get the oldest (in terms of creation date) admin email address. This is needed when user has logged in and he needs to email to admin to get role
   * User who is calling this endpoint does not have any role yet and therefore there can not be 'Role' -validation
   * @returns The oldest (in terms of creation date) admin email address.
   */
  @Get('admin')
  findAdmin() {
    return this.usersService.findByRole('admin')
  }

  /**
   * Receives user location by broadcasting 'user location' -request using web sockets
   * @param userLocation - user's location information
   * @returns
   */
  @Get('locations')
  usersLocations(@Req() req: Request) {
    const { authorization } = req.headers
    if (!authorization) {
      throw new Error('No "authorization" header')
    }
    const [, token] = authorization.split(' ')
    console.log(`*** REQUEST OTHER USERS's LOCATION`)
    return this.usersService.requestUsersLocations(token)
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.usersService.findById(id)
  }

  // NOTE: It's important that all GET endpoints are before POST endpoint, otherwise GET endpoint that is after POST may not be called properly!!

  /**
   * Receives user location and broadcast information using web sockets
   * @param userLocDto - user's location information
   * @returns
   */
  @Post('userLocation')
  userLoc(@Body() userLocDto: UserLocationDto[], @Req() req: Request) {
    const keys = Object.keys(userLocDto)
    const userLocationArray: UserLocationDto[] = JSON.parse(
      `[${keys.toString()}]`,
    )
    console.log(
      `One user's location info: ${JSON.stringify(userLocationArray)}`,
    )

    const { authorization } = req.headers
    if (!authorization) {
      throw new Error('No "authorization" header')
    }
    const [, token] = authorization.split(' ')

    return this.usersService.broadcastLocation(userLocationArray, token)
  }
}
