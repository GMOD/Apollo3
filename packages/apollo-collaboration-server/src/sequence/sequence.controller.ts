import { Controller, Get, Logger, Query } from '@nestjs/common'

import { GetSequenceDto } from './dto/get-sequence.dto'
import { SequenceService } from './sequence.service'

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
