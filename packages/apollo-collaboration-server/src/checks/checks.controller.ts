import { Check, CheckResult } from '@apollo-annotation/schemas'
import { Controller, Get, Logger, Param, Query, Req } from '@nestjs/common'
import { ApiOkResponse } from '@nestjs/swagger'

import { AssemblyAccess } from '../assemblyAccess/assemblyAccess.decorator.js'
import { AssemblyAccessService } from '../assemblyAccess/assemblyAccess.service.js'
import { FeatureRangeSearchDto } from '../entity/gff3Object.dto.js'
import type { RequestWithUser } from '../utils/requestWithUser.js'
import { Role } from '../utils/role/role.enum.js'
import { Validations } from '../utils/validation/validatation.decorator.js'

import { ChecksService } from './checks.service.js'
import { FindChecksDto } from './dto/find-checks.dto.js'

@Validations(Role.ReadOnly)
@Controller('checks')
export class ChecksController {
  constructor(
    private readonly checksService: ChecksService,
    private readonly assemblyAccessService: AssemblyAccessService,
  ) {}
  private readonly logger = new Logger(ChecksController.name)

  /** List check results, optionally only for one assembly */
  @ApiOkResponse({ type: [CheckResult] })
  @AssemblyAccess({
    kind: 'assembly',
    in: 'query',
    key: 'assembly',
    optional: true,
  })
  @Get()
  async findAll(
    @Query() request: FindChecksDto,
    @Req() httpRequest: RequestWithUser,
  ) {
    const allowedAssemblyIds =
      await this.assemblyAccessService.getAllowedAssemblyIds(httpRequest.user)
    // unicorn mistakes this for Array#find, so we ignore it
    // eslint-disable-next-line unicorn/no-array-callback-reference, unicorn/no-array-method-this-argument
    return this.checksService.find(request, allowedAssemblyIds)
  }

  /** List the checks the server can run */
  @ApiOkResponse({ type: [Check] })
  @Get('types')
  getCheckTypes() {
    return this.checksService.getChecks()
  }

  /** Get the check results in a range of a reference sequence */
  @ApiOkResponse({ type: [CheckResult] })
  @AssemblyAccess({ kind: 'refSeq', in: 'query', key: 'refSeq' })
  @Get('range')
  getFeatures(@Query() request: FeatureRangeSearchDto) {
    this.logger.debug(
      `Get checkResults for refSeq: "${request.refSeq}", start: ${request.start}, end: ${request.end}`,
    )
    return this.checksService.findByRange(request)
  }

  /**
   * Get the check results for a feature
   * @param id - Feature ID
   */
  @ApiOkResponse({ type: [CheckResult] })
  @AssemblyAccess({ kind: 'feature', in: 'params', key: 'id' })
  @Get(':id')
  findByFeatureId(@Param('id') id: string) {
    this.logger.debug(`Get checkResults for feature "${id}"`)
    return this.checksService.findByFeatureId(id)
  }
}
