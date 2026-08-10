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
  Response,
  StreamableFile,
} from '@nestjs/common'
import type { Response as ExpressResponse } from 'express'

import { AssemblyAccess } from '../assemblyAccess/assemblyAccess.decorator.js'
import { AssemblyAccessService } from '../assemblyAccess/assemblyAccess.service.js'
import type {
  FeatureIdsSearchDto,
  FeatureRangeSearchDto,
} from '../entity/gff3Object.dto.js'
import type { RequestWithUser } from '../utils/requestWithUser.js'
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
  constructor(
    private readonly featuresService: FeaturesService,
    private readonly assemblyAccessService: AssemblyAccessService,
  ) {}
  private readonly logger = new Logger(FeaturesController.name)

  /**
   * Search database for queries
   * For testing try to go to:
   * http://localhost:3999/features/searchFeatures?term=exonerate
   */
  @AssemblyAccess({
    kind: 'assembly',
    in: 'query',
    key: 'assemblies',
    list: true,
  })
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
  @AssemblyAccess({ kind: 'refSeq', in: 'query', key: 'refSeq' })
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

  @AssemblyAccess({
    kind: 'feature',
    in: 'body',
    key: 'featureIds',
    list: true,
  })
  @Post('getByIds')
  findByFeatureIds(@Body() request: FeatureIdsSearchDto) {
    this.logger.debug(`: featureIds: ${JSON.stringify(request.featureIds)}`)
    return this.featuresService.findByFeatureIds(
      request.featureIds,
      request.topLevel,
    )
  }

  @AssemblyAccess(
    { kind: 'assembly', in: 'query', key: 'assemblyId', optional: true },
    { kind: 'refSeq', in: 'query', key: 'refSeqId', optional: true },
  )
  @Get('count')
  async getFeatureCount(
    @Query() featureCountRequest: FeatureCountRequest,
    @Req() request: RequestWithUser,
  ) {
    this.logger.debug(
      `Get features count by ${JSON.stringify(featureCountRequest)}`,
    )
    const allowedAssemblyIds =
      await this.assemblyAccessService.getAllowedAssemblyIds(request.user)
    const count = await this.featuresService.getFeatureCount(
      featureCountRequest,
      allowedAssemblyIds,
    )
    return { count }
  }

  @AssemblyAccess({
    kind: 'assembly',
    in: 'query',
    key: 'assemblies',
    list: true,
  })
  @Get('getByIndexedId')
  async getById(@Query() getByIndexedIdRequest: GetByIndexedIdRequest) {
    return this.featuresService.getByIndexedId(getByIndexedIdRequest)
  }

  /**
   * Get feature by featureId. When retrieving features by id, the features and any of its children are returned, but not any of its parent or sibling features.
   * @param featureid - featureId
   * @returns Return 'HttpStatus.OK' and the feature(s) if search was successful
   * or if search data was not found or in case of error throw exception
   */
  @AssemblyAccess({ kind: 'feature', in: 'params', key: 'featureid' })
  @Get(':featureid')
  getFeature(
    @Param('featureid') featureid: string,
    @Query('topLevel', new ParseBoolPipe({ optional: true }))
    topLevel: boolean | undefined,
  ) {
    this.logger.debug(`Get feature by featureId: ${featureid}`)
    return this.featuresService.findById(featureid, topLevel)
  }

  @AssemblyAccess({ kind: 'feature', in: 'params', key: 'featureid' })
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
  async getAll(@Req() request: RequestWithUser) {
    this.logger.debug('Get all features')
    const allowedAssemblyIds =
      await this.assemblyAccessService.getAllowedAssemblyIds(request.user)
    return this.featuresService.findAll(allowedAssemblyIds)
  }
}
