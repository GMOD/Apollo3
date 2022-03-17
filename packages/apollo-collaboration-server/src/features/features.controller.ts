import { GFF3FeatureLine } from '@gmod/gff'
import { Body, Controller, Get, Logger, Param, Put, UseGuards } from '@nestjs/common'

import { UpdateEndObjectDto } from '../entity/gff3Object.dto'
import { JwtAuthGuard } from '../utils/jwt-auth.guard'
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
  @Get('/getFeaturesByCriteria')
  getFeaturesByCriteriaV1(@Body() request: GFF3FeatureLine) {
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
   * MONGOTEST ONLY
   */
  //  @UseGuards(JwtAuthGuard)
  @Get('/getfeature/:featureid')
  getFeature(@Param('featureid') featureid: string) {
    this.logger.debug(`Get feature by featureId=${featureid}.`)
    return this.featuresService.getFeatureByFeatureId(featureid)
  }

  /**
   * MONGOTEST ONLY
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
