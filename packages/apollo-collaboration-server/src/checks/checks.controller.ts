import { Check, CheckResult } from '@apollo-annotation/schemas'
import { Controller, Get, Logger, Param, Query } from '@nestjs/common'
import { ApiOkResponse } from '@nestjs/swagger'

import { FeatureRangeSearchDto } from '../entity/gff3Object.dto.js'
import { Role } from '../utils/role/role.enum.js'
import { Validations } from '../utils/validation/validatation.decorator.js'

import { ChecksService } from './checks.service.js'
import { FindChecksDto } from './dto/find-checks.dto.js'

@Validations(Role.ReadOnly)
@Controller('checks')
export class ChecksController {
  constructor(private readonly checksService: ChecksService) {}
  private readonly logger = new Logger(ChecksController.name)

  /** List check results, optionally only for one assembly */
  @ApiOkResponse({ type: [CheckResult] })
  @Get()
  findAll(@Query() request: FindChecksDto) {
    // eslint-disable-next-line unicorn/no-array-callback-reference
    return this.checksService.find(request)
  }

  /** List the checks the server can run */
  @ApiOkResponse({ type: [Check] })
  @Get('types')
  getCheckTypes() {
    return this.checksService.getChecks()
  }

  /** Get the check results in a range of a reference sequence */
  @ApiOkResponse({ type: [CheckResult] })
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
  @Get(':id')
  findByFeatureId(@Param('id') id: string) {
    this.logger.debug(`Get checkResults for feature "${id}"`)
    return this.checksService.findByFeatureId(id)
  }
}
