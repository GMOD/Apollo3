import { RefSeq } from '@apollo-annotation/schemas'
import { Controller, Get, Param, Query } from '@nestjs/common'
import { ApiOkResponse } from '@nestjs/swagger'

import { Role } from '../utils/role/role.enum.js'
import { Validations } from '../utils/validation/validatation.decorator.js'

import { FindRefSeqDto } from './dto/find-refSeq.dto.js'
import { RefSeqsService } from './refSeqs.service.js'

@Validations(Role.ReadOnly)
@Controller('refSeqs')
export class RefSeqsController {
  constructor(private readonly refSeqsService: RefSeqsService) {}

  /** List the reference sequences in an assembly */
  @ApiOkResponse({ type: [RefSeq] })
  @Get()
  findAll(@Query() request: FindRefSeqDto) {
    return this.refSeqsService.findAll(request)
  }

  /** Get a reference sequence */
  @ApiOkResponse({ type: RefSeq })
  @Get(':refseqid')
  getFeature(@Param('refseqid') refseqid: string) {
    return this.refSeqsService.findOne(refseqid)
  }
}
