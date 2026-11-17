import { Assembly } from '@apollo-annotation/schemas'
import { Body, Controller, Get, Head, Param, Post, Req } from '@nestjs/common'
import { ApiExcludeEndpoint, ApiOkResponse } from '@nestjs/swagger'

import { AssemblyAccess } from '../assemblyAccess/assemblyAccess.decorator.js'
import { AssemblyAccessService } from '../assemblyAccess/assemblyAccess.service.js'
import type { RequestWithUser } from '../utils/requestWithUser.js'
import { Role } from '../utils/role/role.enum.js'
import { Validations } from '../utils/validation/validatation.decorator.js'

import { AssembliesService } from './assemblies.service.js'
import { UpdateAssemblyChecksDto } from './dto/update-assembly-checks.dto.js'

@Validations(Role.ReadOnly)
@Controller('assemblies')
export class AssembliesController {
  constructor(
    private readonly assembliesService: AssembliesService,
    private readonly assemblyAccessService: AssemblyAccessService,
  ) {}

  @ApiExcludeEndpoint()
  @Head('checks')
  checksHead() {
    return ''
  }

  /** Set which checks run on an assembly */
  @AssemblyAccess({ kind: 'assembly', in: 'body', key: '_id' })
  @Post('checks')
  updateChecks(@Body() updatedChecks: UpdateAssemblyChecksDto) {
    return this.assembliesService.updateChecks(
      updatedChecks._id,
      updatedChecks.checks,
    )
  }

  /** List all assemblies */
  @ApiOkResponse({ type: [Assembly] })
  @Get()
  async findAll(@Req() request: RequestWithUser) {
    const allowedAssemblyIds =
      await this.assemblyAccessService.getAllowedAssemblyIds(request.user)
    return this.assembliesService.findAll(allowedAssemblyIds)
  }

  /** Get an assembly */
  @ApiOkResponse({ type: Assembly })
  @AssemblyAccess({ kind: 'assembly', in: 'params', key: 'id' })
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.assembliesService.findOne(id)
  }
}
