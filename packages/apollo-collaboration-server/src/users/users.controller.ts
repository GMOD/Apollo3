import { Controller, Get, Param, UseGuards } from '@nestjs/common'

import { JwtAuthGuard } from '../utils/jwt-auth.guard'
import { Role } from '../utils/role/role.enum'
import { Validations } from '../utils/validation/validatation.decorator'
import { UsersService } from './users.service'

@UseGuards(JwtAuthGuard)
@Validations(Role.ReadOnly)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

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

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.usersService.findById(id)
  }
}
