import { Feature } from '@apollo-annotation/schemas'
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Logger,
  Param,
  ParseBoolPipe,
  Post,
  Query,
  Response,
  StreamableFile,
} from '@nestjs/common'
import { ApiOkResponse, ApiQuery } from '@nestjs/swagger'
import type { Response as ExpressResponse } from 'express'

import {
  FeatureIdsSearchDto,
  FeatureRangeSearchDto,
} from '../entity/gff3Object.dto.js'
import { Role } from '../utils/role/role.enum.js'
import { Validations } from '../utils/validation/validatation.decorator.js'

import {
  FeatureCountRequest,
  FeatureDensityRequest,
  GetByIndexedIdRequest,
  SearchFeaturesRequest,
} from './dto/feature.dto.js'
import { FeaturesService } from './features.service.js'

const maxDensityBins = 10_000

@Validations(Role.ReadOnly)
@Controller('features')
export class FeaturesController {
  constructor(private readonly featuresService: FeaturesService) {}
  private readonly logger = new Logger(FeaturesController.name)

  /** Search for features by text in their IDs and attributes */
  @ApiOkResponse({ type: [Feature] })
  @Get('searchFeatures')
  async searchFeatures(@Query() request: SearchFeaturesRequest) {
    return this.featuresService.searchFeatures(request)
  }

  /**
   * Get the features in a range of a reference sequence
   *
   * Streams a JSON array of two arrays: the features that overlap the range,
   * then the check results in the range.
   */
  @ApiOkResponse({
    schema: {
      type: 'array',
      minItems: 2,
      maxItems: 2,
      items: {
        type: 'array',
        items: {
          oneOf: [
            { $ref: '#/components/schemas/Feature' },
            { $ref: '#/components/schemas/CheckResult' },
          ],
        },
      },
    },
  })
  @Get('getFeatures')
  getFeaturesByRange(
    @Query() request: FeatureRangeSearchDto,
    @Response({ passthrough: true }) res: ExpressResponse,
  ) {
    this.logger.debug(
      `getFeatures endpoint: refSeq: ${request.refSeq}, start: ${request.start}, end: ${request.end}`,
    )

    const stream = this.featuresService.findByRangeStream(request)
    res.set({ 'Content-Type': 'application/json' })
    return new StreamableFile(stream).setErrorHandler((error, response) => {
      if (response.destroyed) {
        return
      }
      if (response.headersSent) {
        response.end()
        return
      }
      response.statusCode = 400
      response.send(error.message)
    })
  }

  /** Get features by their IDs */
  @Post('getByIds')
  findByFeatureIds(@Body() request: FeatureIdsSearchDto) {
    this.logger.debug(`: featureIds: ${JSON.stringify(request.featureIds)}`)
    return this.featuresService.findByFeatureIds(
      request.featureIds,
      request.topLevel,
    )
  }

  /** Count features */
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
   * Summarize the density of features in a range
   *
   * Returns how many features overlap the range, and how many overlap each
   * bin of the range expanded to multiples of `binSize`.
   */
  @Get('getFeatureDensity')
  getFeatureDensity(@Query() request: FeatureDensityRequest) {
    const start = Number(request.start)
    const end = Number(request.end)
    const binSize = Number(request.binSize)
    if (
      !request.refSeq ||
      !Number.isFinite(start) ||
      !Number.isFinite(end) ||
      !(binSize >= 1) ||
      end < start
    ) {
      throw new BadRequestException(
        'refSeq, start, end, and a binSize of at least 1 are required',
      )
    }
    if ((end - start) / binSize > maxDensityBins) {
      throw new BadRequestException(
        `Too many bins requested, maximum is ${maxDensityBins}`,
      )
    }
    const featureTypes = request.type === undefined ? [] : [request.type].flat()
    return this.featuresService.getFeatureDensity(
      request.refSeq,
      start,
      end,
      binSize,
      featureTypes,
    )
  }

  /** Get a feature by an indexed ID, such as its GFF3 ID */
  @Get('getByIndexedId')
  async getById(@Query() getByIndexedIdRequest: GetByIndexedIdRequest) {
    return this.featuresService.getByIndexedId(getByIndexedIdRequest)
  }

  /**
   * Get a feature
   *
   * Returns the feature and its children, but not its parent or sibling
   * features.
   * @param featureid - Feature ID
   */
  @ApiQuery({
    name: 'topLevel',
    required: false,
    type: Boolean,
    description: 'Return the top-level feature that contains this feature',
  })
  @Get(':featureid')
  getFeature(
    @Param('featureid') featureid: string,
    @Query('topLevel', new ParseBoolPipe({ optional: true }))
    topLevel?: boolean,
  ) {
    this.logger.debug(`Get feature by featureId: ${featureid}`)
    return this.featuresService.findById(featureid, topLevel)
  }

  /**
   * Run the checks on a feature
   * @param featureid - Feature ID
   */
  @Get('check/:featureid')
  checkFeature(@Param('featureid') featureid: string) {
    return this.featuresService.checkFeature(featureid)
  }

  /** List all features */
  @ApiOkResponse({ type: [Feature] })
  @Get()
  getAll() {
    this.logger.debug('Get all features')
    return this.featuresService.findAll()
  }
}
