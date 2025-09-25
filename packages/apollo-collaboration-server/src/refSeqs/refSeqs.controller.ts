import { Controller, Get, Logger, Query } from '@nestjs/common'

import { Role } from '../utils/role/role.enum'
import { Validations } from '../utils/validation/validatation.decorator'

import { FindRefSeqDto } from './dto/find-refSeq.dto'
import { RefSeqsService } from './refSeqs.service'

@Validations(Role.ReadOnly)
@Controller('refSeqs')
export class RefSeqsController {
  constructor(private readonly refSeqsService: RefSeqsService) {}

  private readonly logger = new Logger(RefSeqsController.name)

  @Get()
  findAll(@Query() request: FindRefSeqDto) {
    return this.refSeqsService.findAll(request)
  }
}
