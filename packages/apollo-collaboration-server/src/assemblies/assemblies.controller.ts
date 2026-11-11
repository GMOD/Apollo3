import { Assembly } from '@apollo-annotation/schemas'
import { Body, Controller, Get, Head, Param, Post } from '@nestjs/common'
import { ApiExcludeEndpoint, ApiOkResponse } from '@nestjs/swagger'

import { Role } from '../utils/role/role.enum.js'
import { Validations } from '../utils/validation/validatation.decorator.js'

import { AssembliesService } from './assemblies.service.js'
import { UpdateAssemblyChecksDto } from './dto/update-assembly-checks.dto.js'

@Validations(Role.ReadOnly)
@Controller('assemblies')
export class AssembliesController {
  constructor(private readonly assembliesService: AssembliesService) {}
  @ApiExcludeEndpoint()
  @Head('checks')
  checksHead() {
    return ''
  }

  /** Set which checks run on an assembly */
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
  findAll() {
    return this.assembliesService.findAll()
  }

  /** Get an assembly */
  @ApiOkResponse({ type: Assembly })
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.assembliesService.findOne(id)
  }
}
