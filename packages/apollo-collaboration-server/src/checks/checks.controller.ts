import { Controller, Get, Logger, Param, Query } from '@nestjs/common'

import { FeatureRangeSearchDto } from '../entity/gff3Object.dto'
import { Public } from '../utils/jwt-auth.guard'
import { Role } from '../utils/role/role.enum'
import { Validations } from '../utils/validation/validatation.decorator'
import { ChecksService } from './checks.service'

@Public()
@Controller('checks')
export class ChecksController {
  constructor(private readonly checksService: ChecksService) {}
  private readonly logger = new Logger(ChecksController.name)

  /**
   * Get all possible checkResults for given range (refSeq, start, end)
   * @param searchDto - range
   * @returns an array of checkResult -documents
   */
  @Validations(Role.ReadOnly)
  @Get('getFeatures')
  getFeatures(@Query() request: FeatureRangeSearchDto) {
    this.logger.debug(
      `Get checkResults for refSeq: "${request.refSeq}", start: ${request.start}, end: ${request.end}`,
    )
    return this.checksService.findByRange(request)
  }

  /**
   * Get all possible checkResults for given featureId
   * @param id - featureId
   * @returns - an array of checkResult -documents
   */
  // @Get(':id')
  // findByFeatureId(@Param('id') id: string) {
  //   this.logger.debug(`Get checkResults for feature "${id}"`)
  //   return this.checksService.findByFeatureId(id)
  // }
  @Public()
  @Get('check/:id')
  findByFeatureId(@Param('id') id: string) {
    return this.checksService.checkFeature(id)
  }
}
