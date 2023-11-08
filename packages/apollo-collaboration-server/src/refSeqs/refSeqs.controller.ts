import { Controller, Get, Logger, Query } from '@nestjs/common'

import { FindRefSeqDto } from './dto/find-refSeq.dto'
import { RefSeqsService } from './refSeqs.service'

@Controller('refSeqs')
export class RefSeqsController {
  constructor(private readonly refSeqsService: RefSeqsService) {}

  private readonly logger = new Logger(RefSeqsController.name)

  @Get()
  findAll(@Query() request: FindRefSeqDto) {
    return this.refSeqsService.findAll(request)
  }
}
