import {
  Body,
  Controller,
  Get,
  Head,
  Logger,
  Param,
  Post,
  Req,
} from '@nestjs/common'

import { AssemblyAccess } from '../assemblyAccess/assemblyAccess.decorator.js'
import { AssemblyAccessService } from '../assemblyAccess/assemblyAccess.service.js'
import type { RequestWithUser } from '../utils/requestWithUser.js'
import { Role } from '../utils/role/role.enum.js'
import { Validations } from '../utils/validation/validatation.decorator.js'

import { AssembliesService } from './assemblies.service.js'

interface AssemblyDocument {
  _id: string
  checks: string[]
}

@Validations(Role.ReadOnly)
@Controller('assemblies')
export class AssembliesController {
  constructor(
    private readonly assembliesService: AssembliesService,
    private readonly assemblyAccessService: AssemblyAccessService,
  ) {}
  private readonly logger = new Logger(AssembliesController.name)

  @Head('checks')
  checksHead() {
    return ''
  }

  @AssemblyAccess({ kind: 'assembly', in: 'body', key: '_id' })
  @Post('checks')
  updateChecks(@Body() updatedChecks: AssemblyDocument) {
    return this.assembliesService.updateChecks(
      updatedChecks._id,
      updatedChecks.checks,
    )
  }

  @Get()
  async findAll(@Req() request: RequestWithUser) {
    const allowedAssemblyIds =
      await this.assemblyAccessService.getAllowedAssemblyIds(request.user)
    return this.assembliesService.findAll(allowedAssemblyIds)
  }

  @AssemblyAccess({ kind: 'assembly', in: 'params', key: 'id' })
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.assembliesService.findOne(id)
  }
}
