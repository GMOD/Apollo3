import type { DecodedJWT } from '@apollo-annotation/shared'
import { Body, Controller, Get, Param, Put, Query, Req } from '@nestjs/common'
import type { Request } from 'express'

import { Role } from '../utils/role/role.enum.js'
import { Validations } from '../utils/validation/validatation.decorator.js'

import { UpdateAssemblyPermissionDto } from './dto/update-assembly-permission.dto.js'
import { AssemblyPermissionsService } from './assemblyPermissions.service.js'

@Validations(Role.Admin)
@Controller('assemblyPermissions')
export class AssemblyPermissionsController {
  constructor(
    private readonly assemblyPermissionsService: AssemblyPermissionsService,
  ) {}

  @Get()
  find(
    @Query('userId') userId?: string,
    @Query('assemblyId') assemblyId?: string,
  ) {
    return this.assemblyPermissionsService.find(userId, assemblyId)
  }

  @Get('byUser/:userId')
  findByUser(@Param('userId') userId: string) {
    return this.assemblyPermissionsService.findByUser(userId)
  }

  @Get('byAssembly/:assemblyId')
  findByAssembly(@Param('assemblyId') assemblyId: string) {
    return this.assemblyPermissionsService.findByAssembly(assemblyId)
  }

  @Put(':userId/:assemblyId')
  upsertPermission(
    @Param('userId') userId: string,
    @Param('assemblyId') assemblyId: string,
    @Body() permission: UpdateAssemblyPermissionDto,
    @Req() req: Request,
  ) {
    const { user } = req as unknown as { user?: DecodedJWT }
    const actor = user?.email || user?.username
    return this.assemblyPermissionsService.upsertPermission(
      userId,
      assemblyId,
      permission,
      actor,
    )
  }
}
