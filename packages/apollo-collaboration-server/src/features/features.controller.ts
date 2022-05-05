import * as fs from 'fs/promises'

import {
  Body,
  Controller,
  Get,
  Logger,
  Param,
  Post,
  Query,
  Response,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express/multer'
import { Response as ExpressResponse } from 'express'

import { FeatureRangeSearchDto } from '../entity/gff3Object.dto'
import { FeaturesService } from './features.service'
import { FileStorageEngine } from '../utils/FileStorageEngine'
import { diskStorage } from 'multer'

@Controller('features')
export class FeaturesController {
  constructor(private readonly featuresService: FeaturesService) {}
  private readonly logger = new Logger(FeaturesController.name)

  /**
   * Load GFF3 file into database.
   * You can call this endpoint like: curl http://localhost:3999/features/importGFF3 -F 'file=\@./save_this_file.txt' -F 'assembly=assemblyId'
   * @param file - File to save
   * @returns Return status 'HttpStatus.OK' if save was successful
   * or in case of error return throw exception
   */
  @Post('importGFF3')
  @UseInterceptors(FileInterceptor('file'))
  async importGFF3(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: { assembly: string },
  ) {
    this.logger.debug(`Adding new features for assemblyId: ${body.assembly}`)
    return this.featuresService.loadGFF3DataIntoDb(file, body.assembly)
  }

  /**
   * Stream file to server and check checksum
   * You can call this endpoint like: curl http://localhost:3999/features/streamFile -F file=\@./volvox.sort.gff3
   * @param file - File to save
   * @returns Return status 'HttpStatus.OK' if save was successful
   * or in case of error return throw exception
   */
  @Post('streamFile')
  @UseInterceptors(FileInterceptor('file', { storage: new FileStorageEngine() }))
  async streamFile(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: JSON,
  ) {
    this.logger.debug(` Body: ${JSON.stringify(body)} `)
    const values = Object.values(body)
    this.logger.debug(` Checksum: ${values[0]} `)
    return 'success'
  }

  // @Post('/uploadtocache')
  // @UseInterceptors( FileInterceptor('file', { storage: diskStorage({ destination: './test',}), }), )
  // // @UseInterceptors(FileInterceptor('file'))
  // async uploadtocache(@UploadedFile() file: Express.Multer.File) {
  //   console.log(file)
  //   // await this.saveNewFile(file)
  // }

  // @Post('upload')
  // @UseInterceptors(FileInterceptor('file'))
  // uploadFile(@UploadedFile() file: Express.Multer.File) {
  //   console.log(file)
  // }

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
      'Content-Disposition': 'attachment; filename="apollo.gff3"',
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
