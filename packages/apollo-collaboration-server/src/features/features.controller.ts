import {
  Body,
  Controller,
  Get,
  Logger,
  Param,
  ParseBoolPipe,
  Post,
  Query,
  Req,
} from '@nestjs/common'
import type { DecodedJWT } from '@apollo-annotation/shared'
import type { Request } from 'express'

import type {
  FeatureIdsSearchDto,
  FeatureRangeSearchDto,
} from '../entity/gff3Object.dto.js'
import { Role } from '../utils/role/role.enum.js'
import { Validations } from '../utils/validation/validatation.decorator.js'

import type {
  FeatureCountRequest,
  GetByIndexedIdRequest,
} from './dto/feature.dto.js'
import { FeaturesService } from './features.service.js'

@Validations(Role.ReadOnly)
@Controller('features')
export class FeaturesController {
  constructor(private readonly featuresService: FeaturesService) {}
  private readonly logger = new Logger(FeaturesController.name)

  /**
   * Search database for queries
   * For testing try to go to:
   * http://localhost:3999/features/searchFeatures?term=exonerate
   */
  @Get('searchFeatures')
  async searchFeatures(
    @Query() request: { term: string; assemblies: string },
    @Req() req: Request,
  ) {
    const { user } = req as unknown as { user: DecodedJWT }
    return this.featuresService.searchFeatures(request, user)
  }

  /**
   * Fetch features based on Reference seq, Start and End -values
   * @param request - Contain search criteria i.e. refSeq, start and end -parameters
   * @returns Return 'HttpStatus.OK' and array of features if search was successful
   * or if search data was not found or in case of error throw exception
   */
  @Get('getFeatures')
  getFeaturesByRange(
    @Query() request: FeatureRangeSearchDto,
    @Req() req: Request,
  ) {
    this.logger.debug(
      `getFeatures endpoint: refSeq: ${request.refSeq}, start: ${request.start}, end: ${request.end}`,
    )
    const { user } = req as unknown as { user: DecodedJWT }

    return this.featuresService.findByRange(request, user)
  }

  @Post('getByIds')
  findByFeatureIds(@Body() request: FeatureIdsSearchDto, @Req() req: Request) {
    this.logger.debug(`: featureIds: ${JSON.stringify(request.featureIds)}`)
    const { user } = req as unknown as { user: DecodedJWT }
    return this.featuresService.findByFeatureIds(
      request.featureIds,
      request.topLevel,
      user,
    )
  }

  @Get('count')
  async getFeatureCount(
    @Query() featureCountRequest: FeatureCountRequest,
    @Req() req: Request,
  ) {
    this.logger.debug(
      `Get features count by ${JSON.stringify(featureCountRequest)}`,
    )
    const { user } = req as unknown as { user: DecodedJWT }
    const count = await this.featuresService.getFeatureCount(
      featureCountRequest,
      user,
    )
    return { count }
  }

  @Get('getByIndexedId')
  async getById(
    @Query() getByIndexedIdRequest: GetByIndexedIdRequest,
    @Req() req: Request,
  ) {
    const { user } = req as unknown as { user: DecodedJWT }
    return this.featuresService.getByIndexedId(getByIndexedIdRequest, user)
  }

  /**
   * Get feature by featureId. When retrieving features by id, the features and any of its children are returned, but not any of its parent or sibling features.
   * @param featureid - featureId
   * @returns Return 'HttpStatus.OK' and the feature(s) if search was successful
   * or if search data was not found or in case of error throw exception
   */
  @Get(':featureid')
  getFeature(
    @Param('featureid') featureid: string,
    @Query('topLevel', new ParseBoolPipe({ optional: true }))
    topLevel: boolean | undefined,
    @Req() req: Request,
  ) {
    this.logger.debug(`Get feature by featureId: ${featureid}`)
    const { user } = req as unknown as { user: DecodedJWT }
    return this.featuresService.findById(featureid, topLevel, user)
  }

  @Get('check/:featureid')
  checkFeature(@Param('featureid') featureid: string) {
    return this.featuresService.checkFeature(featureid)
  }

  /**
   * Fetch all features
   * @returns Return 'HttpStatus.OK' and array of features if search was successful
   * or if search data was not found or in case of error throw exception
   */
  @Get()
  getAll(@Req() req: Request) {
    this.logger.debug('Get all features')
    const { user } = req as unknown as { user: DecodedJWT }
    return this.featuresService.findAll(user)
  }
}
