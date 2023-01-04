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
   * @param userLocation - user's location information
   * @returns
   */
  @Post('userLocation')
  userLoc(@Body() userLocation: Array<UserLocationDto>, @Req() req: Request) {
    console.log(`One user's location info: ${JSON.stringify(userLocation)}`)
    const keys = Object.keys(userLocation)

    // const a: UserLocationDto[] = JSON.parse(JSON.stringify(userLocation))
    // console.log(`A: ${JSON.stringify(a)}`)
    const b: UserLocationDto[] = JSON.parse(`[${keys.toString()}]`)
    // const b: UserLocationDto[] = JSON.parse(`[{"assemblyId":"63a2dca3fa2f1bdce7478adc","refSeq":"ctgA","start":2869.1935605863114,"end":35426.79890109365},{"assemblyId":"63a2dca3fa2f1bdce7478adc","refSeq":"ctgA","start":11431.551484015054,"end":50001}]`)
    console.log(`B: ${JSON.stringify(b)}`)
    console.log(`LEN B: ${b.length}`)

    const { authorization } = req.headers
    if (!authorization) {
      throw new Error('No "authorization" header')
    }
    const [, token] = authorization.split(' ')

    return this.usersService.broadcastLocation(b, token)
    // return this.usersService.broadcastLocation(userLocation, token)
  }
}
