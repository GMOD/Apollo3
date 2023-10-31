import { Controller, Get, Logger, Param, Query } from '@nestjs/common'

import { FeatureRangeSearchDto } from '../entity/gff3Object.dto'
import { Public } from '../utils/jwt-auth.guard'
import { Role } from '../utils/role/role.enum'
import { Validations } from '../utils/validation/validatation.decorator'
import { ChecksService } from './checks.service'

@Validations(Role.ReadOnly)
@Public()
@Controller('checks')
export class ChecksController {
  constructor(private readonly checksService: ChecksService) {}
  private readonly logger = new Logger(ChecksController.name)

  /**
   * Get all possible checkReports for given range (refSeq, start, end)
   * @param searchDto - range
   * @returns an array of checkReport -documents
   */
  @Get('getFeatures')
  getFeatures(@Query() request: FeatureRangeSearchDto) {
    this.logger.debug(
      `Get checkReports for refSeq: "${request.refSeq}", start: ${request.start}, end: ${request.end}`,
    )
    return this.checksService.findByRange(request)
  }

  /**
   * Get all possible checkReports for given featureId
   * @param id - featureId
   * @returns - an array of checkReport -documents
   */
  @Get(':id')
  findByFeatureId(@Param('id') id: string) {
    this.logger.debug(`Get checkReports for feature "${id}"`)
    return this.checksService.findByFeatureId(id)
  }
}
