/* eslint-disable @typescript-eslint/no-unnecessary-condition */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import type { DecodedJWT } from '@apollo-annotation/shared'
import {
  Body,
  Controller,
  Get,
  Logger,
  Param,
  Post,
  Query,
  Req,
} from '@nestjs/common'
import { ApiExcludeEndpoint } from '@nestjs/swagger'
import type { Request } from 'express'

import { Role } from '../utils/role/role.enum.js'
import { Validations } from '../utils/validation/validatation.decorator.js'

import { UserLocationDto } from './dto/create-user.dto.js'
import { FindUsersDto } from './dto/find-users.dto.js'
import { UsersService, toUserResponse } from './users.service.js'

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}
  private readonly logger = new Logger(UsersController.name)

  /**
   * List users
   *
   * If `page` and `pageSize` are given, returns
   * `{ users, totalCount, specialUsers }`, where `users` is one page of regular
   * users and `specialUsers` is the guest and root users (if they exist).
   * Otherwise returns an array of all users.
   */
  @Validations(Role.Admin)
  @Get()
  async findAll(@Query() findUsersDto: FindUsersDto) {
    if (
      findUsersDto.page !== undefined &&
      findUsersDto.pageSize !== undefined
    ) {
      return this.usersService.findPage(findUsersDto)
    }
    const users = await this.usersService.findAll()
    return users.map((user) => toUserResponse(user))
  }

  /**
   * Get the first admin user
   *
   * Lets a user who has logged in but doesn't have a role yet find out who to
   * contact, so it doesn't require a role.
   */
  @Validations(Role.None)
  @Get('admin')
  findAdmin() {
    return this.usersService.findByRole(Role.Admin)
  }

  /**
   * Ask other users' clients to share their locations
   *
   * The locations are sent to connected clients over the server's WebSocket
   * connection, not in this response.
   */
  @Validations(Role.ReadOnly)
  @Get('locations')
  usersLocations(@Req() req: Request) {
    const { user } = req as unknown as { user: DecodedJWT }
    if (!user) {
      throw new Error('No user attached to request')
    }
    this.logger.debug('Requesting other users locations')
    return this.usersService.requestUsersLocations(user)
  }

  /**
   * Get a user
   * @param id - User ID
   */
  @Validations(Role.Admin)
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
  // Left out of the API docs because it's only for the Apollo JBrowse plugin,
  // which sends the locations as JSON in a form-encoded body
  @ApiExcludeEndpoint()
  @Validations(Role.ReadOnly)
  @Post('userLocation')
  userLoc(@Body() userLocDto: UserLocationDto[], @Req() req: Request) {
    const keys = Object.keys(userLocDto)
    const userLocationArray: UserLocationDto[] = JSON.parse(
      `[${keys.toString()}]`,
    )
    this.logger.debug(
      `One user's location info: ${JSON.stringify(userLocationArray)}`,
    )

    const { user } = req as unknown as { user: DecodedJWT }
    if (!user) {
      throw new Error('No user attached to request')
    }
    return this.usersService.broadcastLocation(userLocationArray, user)
  }
}
