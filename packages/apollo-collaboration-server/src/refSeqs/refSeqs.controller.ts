import { RefSeq } from '@apollo-annotation/schemas'
import { Controller, Get, Param, Query, Req } from '@nestjs/common'
import { ApiOkResponse } from '@nestjs/swagger'

import { AssemblyAccess } from '../assemblyAccess/assemblyAccess.decorator.js'
import { AssemblyAccessService } from '../assemblyAccess/assemblyAccess.service.js'
import type { RequestWithUser } from '../utils/requestWithUser.js'
import { Role } from '../utils/role/role.enum.js'
import { Validations } from '../utils/validation/validatation.decorator.js'

import { FindRefSeqDto } from './dto/find-refSeq.dto.js'
import { RefSeqsService } from './refSeqs.service.js'

@Validations(Role.ReadOnly)
@Controller('refSeqs')
export class RefSeqsController {
  constructor(
    private readonly refSeqsService: RefSeqsService,
    private readonly assemblyAccessService: AssemblyAccessService,
  ) {}

  /** List the reference sequences in an assembly */
  @ApiOkResponse({ type: [RefSeq] })
  @AssemblyAccess({
    kind: 'assembly',
    in: 'query',
    key: 'assembly',
    optional: true,
  })
  @Get()
  async findAll(
    @Query() request: FindRefSeqDto,
    @Req() httpRequest: RequestWithUser,
  ) {
    const allowedAssemblyIds =
      await this.assemblyAccessService.getAllowedAssemblyIds(httpRequest.user)
    return this.refSeqsService.findAll(request, allowedAssemblyIds)
  }

  /** Get a reference sequence */
  @ApiOkResponse({ type: RefSeq })
  @AssemblyAccess({ kind: 'refSeq', in: 'params', key: 'refseqid' })
  @Get(':refseqid')
  getFeature(@Param('refseqid') refseqid: string) {
    return this.refSeqsService.findOne(refseqid)
  }
}
