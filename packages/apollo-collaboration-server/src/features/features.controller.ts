import {
  Controller,
  Get,
  Logger,
  Param,
  Query,
  Response,
  StreamableFile,
} from '@nestjs/common'
import { Response as ExpressResponse } from 'express'

import { FeatureRangeSearchDto } from '../entity/gff3Object.dto'
import { FeaturesService } from './features.service'

@Controller('features')
export class FeaturesController {
  constructor(private readonly featuresService: FeaturesService) {}
  private readonly logger = new Logger(FeaturesController.name)

  /**
   * Export GFF3 from database.
   * e.g: curl http://localhost:3999/features/exportGFF3?assembly=624a7e97d45d7745c2532b01
   *
   * @param request -
   * @param res -
   * @returns A StreamableFile of the GFF3
   */
  @Get('exportGFF3')
  async exportGFF3(
    @Query() request: { assembly: string },
    @Response({ passthrough: true }) res: ExpressResponse,
  ) {
    res.set({
      'Content-Type': 'application/text',
      'Content-Disposition': `attachment; filename="${request.assembly}_apollo.gff3"`,
    })
    const stream = await this.featuresService.exportGFF3(request.assembly)
    return new StreamableFile(stream)
  }

  /**
   * Fetch features based on Reference seq, Start and End -values
   * @param request - Contain search criteria i.e. refname, start and end -parameters
   * @returns Return 'HttpStatus.OK' and array of features if search was successful
   * or if search data was not found or in case of error throw exception
   */
  //    @UseGuards(JwtAuthGuard)
  @Get('getFeatures')
  getFeatures(@Query() request: FeatureRangeSearchDto) {
    this.logger.debug(
      `getFeaturesByCriteria -method: refSeq: ${request.refSeq}, start: ${request.start}, end: ${request.end}=`,
    )

    return this.featuresService.findByRange(request)
  }

  /**
   * Get feature by featureId. When retrieving features by id, the features and any of its children are returned, but not any of its parent or sibling features.
   * @param featureid - featureId
   * @returns Return 'HttpStatus.OK' and the feature(s) if search was successful
   * or if search data was not found or in case of error throw exception
   */
  //  @UseGuards(JwtAuthGuard)
  @Get(':featureid')
  getFeature(@Param('featureid') featureid: string) {
    this.logger.debug(`Get feature by featureId: ${featureid}`)
    return this.featuresService.findById(featureid)
  }

  /**
   * Fetch all features
   * @returns Return 'HttpStatus.OK' and array of features if search was successful
   * or if search data was not found or in case of error throw exception
   */
  @Get()
  getAll() {
    this.logger.debug(`Get all features`)
    return this.featuresService.findAll()
  }
}
