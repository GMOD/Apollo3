import { Controller, Get, Logger, Param } from '@nestjs/common'

import { Role } from '../utils/role/role.enum'
import { Validations } from '../utils/validation/validatation.decorator'
import { AssembliesService } from './assemblies.service'

@Validations(Role.ReadOnly)
@Controller('assemblies')
export class AssembliesController {
  constructor(private readonly assembliesService: AssembliesService) {}
  private readonly logger = new Logger(AssembliesController.name)

  @Get()
  findAll() {
    return this.assembliesService.findAll()
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.assembliesService.findOne(id)
  }
}
