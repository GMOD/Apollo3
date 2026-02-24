import { Controller, Get, Logger, Param, Query } from '@nestjs/common'

import { Role } from '../utils/role/role.enum.js'
import { Validations } from '../utils/validation/validatation.decorator.js'

import { FindRefSeqDto } from './dto/find-refSeq.dto.js'
import { RefSeqsService } from './refSeqs.service.js'

@Validations(Role.ReadOnly)
@Controller('refSeqs')
export class RefSeqsController {
  constructor(private readonly refSeqsService: RefSeqsService) {}

  private readonly logger = new Logger(RefSeqsController.name)

  @Get()
  findAll(@Query() request: FindRefSeqDto) {
    return this.refSeqsService.findAll(request)
  }

  @Get(':refseqid')
  getFeature(@Param('refseqid') refseqid: string) {
    return this.refSeqsService.findOne(refseqid)
  }
}
