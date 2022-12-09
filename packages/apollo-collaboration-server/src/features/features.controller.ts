import {
  Controller,
  Get,
  Logger,
  Param,
  Query,
  Response,
  StreamableFile,
  UseGuards,
} from '@nestjs/common'
import { Response as ExpressResponse } from 'express'

import { FeatureRangeSearchDto } from '../entity/gff3Object.dto'
import { JwtAuthGuard } from '../utils/jwt-auth.guard'
import { Role } from '../utils/role/role.enum'
import { Validations } from '../utils/validation/validatation.decorator'
import { FeaturesService } from './features.service'

@Controller('features')
export class FeaturesController {
  constructor(private readonly featuresService: FeaturesService) {}
  private readonly logger = new Logger(FeaturesController.name)

  /**
   * Export GFF3 from database.
   * e.g: curl http://localhost:3999/features/exportGFF3?exportID=624a7e97d45d7745c2532b01
   *
   * @param request -
   * @param res -
   * @returns A StreamableFile of the GFF3
   */
  @Get('exportGFF3')
  async exportGFF3(
    @Query() request: { exportID: string },
    @Response({ passthrough: true }) res: ExpressResponse,
  ) {
    const [stream, assembly] = await this.featuresService.exportGFF3(
      request.exportID,
    )
    res.set({
      'Content-Type': 'application/text',
      'Content-Disposition': `attachment; filename="${assembly}_apollo.gff3"`,
    })
    // TODO: remove ts-ignores below after a resolution for this issue is
    // released: https://github.com/nestjs/nest/issues/10681
    return new StreamableFile(stream).setErrorHandler((error, response) => {
      if (response.destroyed) {
        return
      }

      // @ts-ignore
      if (response.headersSent) {
        // TODO: maybe broadcast message to user that they shouldn't trust the
        // exported GFF3? From the client side there's no way to tell this
        // stream terminated early.

        // @ts-ignore
        response.end()
        return
      }
      response.statusCode = 400
      response.send(error.message)
    })
  }

  /**
   * Get and ID to be used with exportGFF3. ID will be valid for 5 minutes.
   * @param request -
   * @returns The ID of an export that will be valid for 5 minutes
   */
  @UseGuards(JwtAuthGuard)
  @Validations(Role.ReadOnly)
  @Get('getExportID')
  async getExportID(@Query() request: { assembly: string }) {
    const exportDoc = await this.featuresService.getExportID(request.assembly)
    return { exportID: exportDoc._id }
  }

  /**
   * Fetch features based on Reference seq, Start and End -values
   * @param request - Contain search criteria i.e. refSeq, start and end -parameters
   * @returns Return 'HttpStatus.OK' and array of features if search was successful
   * or if search data was not found or in case of error throw exception
   */
  @UseGuards(JwtAuthGuard)
  @Validations(Role.ReadOnly)
  @Get('getFeatures')
  getFeatures(@Query() request: FeatureRangeSearchDto) {
    this.logger.debug(
      `getFeaturesByCriteria -method: refSeq: ${request.refSeq}, start: ${request.start}, end: ${request.end}`,
    )

    return this.featuresService.findByRange(request)
  }

  /**
   * Get feature by featureId. When retrieving features by id, the features and any of its children are returned, but not any of its parent or sibling features.
   * @param featureid - featureId
   * @returns Return 'HttpStatus.OK' and the feature(s) if search was successful
   * or if search data was not found or in case of error throw exception
   */
  @UseGuards(JwtAuthGuard)
  @Validations(Role.ReadOnly)
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
  @UseGuards(JwtAuthGuard)
  @Validations(Role.ReadOnly)
  @Get()
  getAll() {
    this.logger.debug(`Get all features`)
    return this.featuresService.findAll()
  }
}
