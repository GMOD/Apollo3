import { GFF3FeatureLine } from '@gmod/gff'
import {
  Body,
  Controller,
  Get,
  Logger,
  Param,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express/multer'
import { FeatureRangeSearchDto } from '../entity/gff3Object.dto'

import { AssemblyIdDto } from '../model/gff3.model'
import { FeaturesService } from './features.service'

@Controller('features')
export class FeaturesController {
  constructor(private readonly featuresService: FeaturesService) {}
  private readonly logger = new Logger(FeaturesController.name)

  /**
   * Save new uploaded file into local filesystem and then loads it into database. The file is first saved to local filesystem using name: 'uploaded' + timestamp in ddmmyyyy_hh24miss -format + original filename
   * You can call this endpoint like: curl http://localhost:3999/features/importGFF3 -F 'file=\@./save_this_file.txt' -F 'assembly=assemblyId'
   * @param file - File to save
   * @returns Return status 'HttpStatus.OK' if save was successful
   * or in case of error return throw exception
   */
  @Post('/importGFF3')
  @UseInterceptors(FileInterceptor('file'))
  async importGFF3(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: AssemblyIdDto,
  ) {
    this.logger.debug(`Adding new features for assemblyId: ${body.assemblyId}`)
    const fileName = await this.featuresService.saveNewFile(file)
    this.featuresService.loadGFF3DataIntoDb(fileName, body.assemblyId)
  }

  /**
   * Get feature by featureId. When retrieving features by id, the features and any of its children are returned, but not any of its parent or sibling features.
   * @param featureid - featureId
   * @returns Return 'HttpStatus.OK' and the feature(s) if search was successful
   * or if search data was not found or in case of error throw exception
   */
  //  @UseGuards(JwtAuthGuard)
  @Get('/getFeature/:featureid')
  getFeature(@Param('featureid') featureid: string) {
    this.logger.debug(`Get feature by featureId=${featureid}.`)
    return this.featuresService.getFeatureByFeatureId(featureid)
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

  /**
   * Fetch features based on Reference seq, Start and End -values
   * @param request - Contain search criteria i.e. refname, start and end -parameters
   * @returns Return 'HttpStatus.OK' and array of features if search was successful
   * or if search data was not found or in case of error throw exception
   */
  //    @UseGuards(JwtAuthGuard)
  @Get('/getFeatures')
  getFeatures(@Body() request: FeatureRangeSearchDto) {
    this.logger.debug(
      `getFeaturesByCriteria -method: AssemblyId: ${request.assemblyId} refName: ${request.refName}, start: ${request.start}, end: ${request.end}=`,
    )

    return this.featuresService.getFeaturesByCriteria(request)
  }
}
