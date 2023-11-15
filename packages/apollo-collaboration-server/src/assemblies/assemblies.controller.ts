import {
  Body,
  Controller,
  Get,
  Head,
  Logger,
  Param,
  Post,
} from '@nestjs/common'

import { Role } from '../utils/role/role.enum'
import { Validations } from '../utils/validation/validatation.decorator'
import { AssembliesService } from './assemblies.service'

interface AssemblyDocument {
  _id: string
  checks: string[]
}

@Validations(Role.ReadOnly)
@Controller('assemblies')
export class AssembliesController {
  constructor(private readonly assembliesService: AssembliesService) {}
  private readonly logger = new Logger(AssembliesController.name)

  @Head('checks')
  checksHead() {
    return ''
  }

  @Post('checks')
  updateChecks(@Body() updatedChecks: AssemblyDocument) {
    return this.assembliesService.updateChecks(
      updatedChecks._id,
      updatedChecks.checks,
    )
  }

  @Get()
  findAll() {
    return this.assembliesService.findAll()
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.assembliesService.findOne(id)
  }
}
