import { GFF3FeatureLine } from '@gmod/gff'
import { Body, Controller, Get, Logger, Param, Put } from '@nestjs/common'

import { UpdateEndObjectDto } from '../entity/gff3Object.dto'
// import { JwtAuthGuard } from '../utils/jwt-auth.guard'
import { FeaturesService } from './features.service'

@Controller('features')
export class FeaturesController {
  constructor(private readonly featuresService: FeaturesService) {}
  private readonly logger = new Logger(FeaturesController.name)

  /**
   * Fetch features based on Reference seq, Start and End -values
   * @param request - Contain search criteria i.e. refname, start and end -parameters
   * @returns Return 'HttpStatus.OK' and array of features if search was successful
   * or if search data was not found or in case of error throw exception
   */
  //    @UseGuards(JwtAuthGuard)
  @Get('/getFeatures')
  getFeatures(@Body() request: GFF3FeatureLine) {
    this.logger.debug(
      `getFeaturesByCriteria -method: Seq_id=${request.seq_id}=, Start=${request.start}=, End=${request.end}=`,
    )
    const searchDto: GFF3FeatureLine = {
      seq_id: `${request.seq_id}`,
      start: parseInt(`${request.start}`, 10),
      end: parseInt(`${request.end}`, 10),
      source: null,
      type: null,
      score: null,
      strand: null,
      phase: null,
      attributes: null,
    }

    return this.featuresService.getFeaturesByCriteria(searchDto)
  }

  /**
   * Get feature by featureId. When retrieving features by id, the features and any of its children are returned, but not any of its parent or sibling features.
   * @param featureid - featureId
   * @returns Return 'HttpStatus.OK' and the feature(s) if search was successful
   * or if search data was not found or in case of error throw exception
   */
  //  @UseGuards(JwtAuthGuard)
  @Get('/:featureid')
  getFeature(@Param('featureid') featureid: string) {
    this.logger.debug(`Get feature by featureId=${featureid}.`)
    return this.featuresService.getFeatureByFeatureId(featureid)
  }

  /**
   * Updates end position of given feature. Before update, current end -position value is checked (against given old-value)
   * @param postDto - Interface containing featureId, newEndValue, oldEndValue
   * @returns Return 'HttpStatus.OK' if featureId was found AND oldEndValue matched AND database update was successfull. Otherwise throw exception.
   */
  //  @UseGuards(JwtAuthGuard)
  @Put('/updateEndPos')
  updateMongo(@Body() postDto: UpdateEndObjectDto) {
    this.logger.debug(
      `Update Mongo document where featureId=${
        postDto.featureId
      } and old value=${JSON.stringify(
        postDto.oldEnd,
      )}. New value will be ${JSON.stringify(postDto.newEnd)}.`,
    )
    return this.featuresService.updateEndPosInMongo(postDto)
  }
}
