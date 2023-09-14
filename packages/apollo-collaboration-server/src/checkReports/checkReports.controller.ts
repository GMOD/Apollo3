import { Controller, Get, Logger, Query } from '@nestjs/common'

import { FeatureRangeSearchDto } from '../entity/gff3Object.dto'
import { Public } from '../utils/jwt-auth.guard'
import { CheckReportsService } from './checkReports.service'

@Public()
@Controller('checkReports')
export class CheckReportsController {
  private readonly logger = new Logger(CheckReportsController.name)

  constructor(private readonly checkReportsService: CheckReportsService) {}

  @Get('checkFeatures')
  async checkFeatures(@Query() request: FeatureRangeSearchDto) {
    this.logger.debug(
      `getFeaturesByCriteria -method: refSeq: ${request.refSeq}, start: ${request.start}, end: ${request.end}`,
    )
    // eslint-disable-next-line @typescript-eslint/return-await
    return await this.checkReportsService.checkFeatureRange(request)
  }
}
