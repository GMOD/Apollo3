import { Controller, Get, Logger, Param, Query } from '@nestjs/common'

import { FeatureRangeSearchDto } from '../entity/gff3Object.dto'
import { Public } from '../utils/jwt-auth.guard'
import { Role } from '../utils/role/role.enum'
import { Validations } from '../utils/validation/validatation.decorator'
import { FeatureCountRequest } from './dto/feature.dto'
import { FeaturesService } from './features.service'

@Controller('features')
export class FeaturesController {
  constructor(private readonly featuresService: FeaturesService) {}
  private readonly logger = new Logger(FeaturesController.name)

  /**
   * Search database for queries
   * For testing try to go to:
   * http://localhost:3999/features/searchFeatures?term=exonerate
   */
  @Public()
  @Get('searchFeatures')
  async searchFeatures(@Query() request: { term: string; assemblies: string }) {
    return this.featuresService.searchFeatures(request)
  }

  /**
   * Fetch features based on Reference seq, Start and End -values
   * @param request - Contain search criteria i.e. refSeq, start and end -parameters
   * @returns Return 'HttpStatus.OK' and array of features if search was successful
   * or if search data was not found or in case of error throw exception
   */
  @Validations(Role.ReadOnly)
  @Get('getFeatures')
  getFeatures(@Query() request: FeatureRangeSearchDto) {
    this.logger.debug(
      `getFeaturesByCriteria -method: refSeq: ${request.refSeq}, start: ${request.start}, end: ${request.end}`,
    )

    return this.featuresService.findByRange(request)
  }

  @Validations(Role.ReadOnly)
  @Get('count')
  async getFeatureCount(@Query() featureCountRequest: FeatureCountRequest) {
    this.logger.debug(
      `Get features count by ${JSON.stringify(featureCountRequest)}`,
    )
    const count =
      await this.featuresService.getFeatureCount(featureCountRequest)
    return { count }
  }

  /**
   * Get feature by featureId. When retrieving features by id, the features and any of its children are returned, but not any of its parent or sibling features.
   * @param featureid - featureId
   * @param parentId - If true, the parent feature id is also returned
   * @returns Return 'HttpStatus.OK' and the feature(s) if search was successful
   * or if search data was not found or in case of error throw exception
   */
  @Validations(Role.ReadOnly)
  @Get(':featureid')
  getFeature(
    @Param('featureid') featureid: string,
    @Query('parentId') parentId: string,
  ) {
    return this.featuresService.findById(featureid, parentId === 'true')
  }

  @Public()
  @Get('check/:featureid')
  checkFeature(@Param('featureid') featureid: string) {
    return this.featuresService.checkFeature(featureid)
  }

  /**
   * Fetch all features
   * @returns Return 'HttpStatus.OK' and array of features if search was successful
   * or if search data was not found or in case of error throw exception
   */
  @Validations(Role.ReadOnly)
  @Get()
  getAll() {
    this.logger.debug('Get all features')
    return this.featuresService.findAll()
  }
}
