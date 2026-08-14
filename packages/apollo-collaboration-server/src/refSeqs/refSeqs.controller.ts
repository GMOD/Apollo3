import { Controller, Get, Logger, Param, Query, Req } from '@nestjs/common'

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

  private readonly logger = new Logger(RefSeqsController.name)

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

  @AssemblyAccess({ kind: 'refSeq', in: 'params', key: 'refseqid' })
  @Get(':refseqid')
  getFeature(@Param('refseqid') refseqid: string) {
    return this.refSeqsService.findOne(refseqid)
  }
}
