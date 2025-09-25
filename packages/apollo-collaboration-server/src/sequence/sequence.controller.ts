import { Controller, Get, Logger, Query } from '@nestjs/common'

import { Role } from '../utils/role/role.enum'
import { Validations } from '../utils/validation/validatation.decorator'

import { GetSequenceDto } from './dto/get-sequence.dto'
import { SequenceService } from './sequence.service'

@Validations(Role.ReadOnly)
@Controller('sequence')
export class SequenceController {
  constructor(private readonly sequenceService: SequenceService) {}

  private readonly logger = new Logger(SequenceController.name)

  @Get()
  getSequence(@Query() request: GetSequenceDto) {
    this.logger.debug(`getSequence: ${JSON.stringify(request)}`)
    return this.sequenceService.getSequence(request)
  }
}
