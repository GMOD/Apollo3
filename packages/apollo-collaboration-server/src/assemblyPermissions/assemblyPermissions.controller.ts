import type { DecodedJWT } from '@apollo-annotation/shared'
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  Req,
} from '@nestjs/common'
import type { Request } from 'express'

import { Role } from '../utils/role/role.enum.js'
import { Validations } from '../utils/validation/validatation.decorator.js'

import { AssemblyPermissionsService } from './assemblyPermissions.service.js'
import { UpdateAssemblyPermissionDto } from './dto/update-assembly-permission.dto.js'

interface CreateGroupDto {
  name: string
  description?: string
}

interface UpdateGroupMembershipDto {
  isMember: boolean
}

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
    // eslint-disable-next-line unicorn/no-array-callback-reference, unicorn/no-array-method-this-argument
    return this.assemblyPermissionsService.find(userId, assemblyId)
  }

  @Get('byUser/:userId')
  findByUser(@Param('userId') userId: string) {
    return this.assemblyPermissionsService.findByUser(userId)
  }

  @Validations(Role.ReadOnly)
  @Get('mine')
  findMine(@Req() req: Request) {
    const { user } = req as unknown as { user?: DecodedJWT }
    if (!user?.id) {
      return []
    }
    return this.assemblyPermissionsService.findEffectiveByUser(user.id)
  }

  @Get('effective/byUser/:userId')
  findEffectiveByUser(@Param('userId') userId: string) {
    return this.assemblyPermissionsService.findEffectiveByUser(userId)
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
    const actor = user?.email ?? user?.username
    return this.assemblyPermissionsService.upsertPermission(
      userId,
      assemblyId,
      permission,
      actor,
    )
  }

  @Get('groups')
  findGroups() {
    return this.assemblyPermissionsService.findGroups()
  }

  @Post('groups')
  createGroup(@Body() body: CreateGroupDto, @Req() req: Request) {
    const { user } = req as unknown as { user?: DecodedJWT }
    const actor = user?.email ?? user?.username
    return this.assemblyPermissionsService.createGroup(
      body.name,
      body.description,
      actor,
    )
  }

  @Delete('groups/:groupId')
  deleteGroup(@Param('groupId') groupId: string) {
    return this.assemblyPermissionsService.deleteGroup(groupId)
  }

  @Get('groups/memberships/byUser/:userId')
  findGroupMembershipsByUser(@Param('userId') userId: string) {
    return this.assemblyPermissionsService.findGroupMembershipsByUser(userId)
  }

  @Get('groups/memberships/byGroup/:groupId')
  findGroupMembershipsByGroup(@Param('groupId') groupId: string) {
    return this.assemblyPermissionsService.findGroupMembershipsByGroup(groupId)
  }

  @Put('groups/memberships/:groupId/:userId')
  setGroupMembership(
    @Param('groupId') groupId: string,
    @Param('userId') userId: string,
    @Body() body: UpdateGroupMembershipDto,
    @Req() req: Request,
  ) {
    const { user } = req as unknown as { user?: DecodedJWT }
    const actor = user?.email ?? user?.username
    return this.assemblyPermissionsService.setGroupMembership(
      groupId,
      userId,
      Boolean(body.isMember),
      actor,
    )
  }

  @Get('groups/permissions/:groupId')
  findGroupPermissions(@Param('groupId') groupId: string) {
    return this.assemblyPermissionsService.findGroupPermissions(groupId)
  }

  @Put('groups/permissions/:groupId/:assemblyId')
  upsertGroupPermission(
    @Param('groupId') groupId: string,
    @Param('assemblyId') assemblyId: string,
    @Body() permission: UpdateAssemblyPermissionDto,
    @Req() req: Request,
  ) {
    const { user } = req as unknown as { user?: DecodedJWT }
    const actor = user?.email ?? user?.username
    return this.assemblyPermissionsService.upsertGroupPermission(
      groupId,
      assemblyId,
      permission,
      actor,
    )
  }
}
