import { createReadStream } from 'fs'
import { join } from 'path'
import { stringify } from 'querystring'

import { GFF3FeatureLine } from '@gmod/gff'
import {
  Body,
  Controller,
  Get,
  InternalServerErrorException,
  Logger,
  Param,
  Post,
  Put,
  Req,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express/multer'
import { Request } from 'express'

import {
  GFF3ChangeLineObjectDto,
  UpdateEndObjectDto,
} from '../entity/gff3Object.dto'
import { JwtAuthGuard } from '../utils/jwt-auth.guard'
import { FileHandlingService } from './fileHandling.service'

@Controller('fileHandling')
export class FileHandlingController {
  constructor(private readonly fileService: FileHandlingService) {}
  private readonly logger = new Logger(FileHandlingController.name)

  /**
   * Download file from server to client. The given filename must exists in pre-defined folder (see fileConfig.ts)
   * You can call this endpoint like: curl http://localhost:3000/fileHandling/getfile/your_filename.txt
   * @param filename - File to download
   * @returns
   */
  @UseGuards(JwtAuthGuard)
  @Get('/getfile/:filename')
  getFile(@Param('filename') filename: string) {
    // Check if file exists
    if (!this.fileService.fileExists(filename)) {
      this.logger.error(
        `File =${filename}= does not exist in folder =${process.env.FILE_SEARCH_FOLDER}=`,
      )
      throw new InternalServerErrorException(`File ${filename} does not exist!`)
    }
    this.logger.debug(`Starting to download file ${filename}`)

    // Download file
    const { FILE_SEARCH_FOLDER } = process.env
    if (!FILE_SEARCH_FOLDER) {
      throw new Error('No FILE_SEARCH_FOLDER found in .env file')
    }
    const file = createReadStream(join(FILE_SEARCH_FOLDER, filename))
    return new StreamableFile(file)
  }

  /**
   * Updates string (or whole line) in existing file
   * @param id - Filename to be updated
   * @param postDto - Data Transfer Object that contains information about original string/line and updated string/line
   * @returns Return 'HttpStatus.OK' if update was successful
   * or if search string/line was not found in the file then return error message with HttpStatus.NOT_FOUND
   * or in case of error return throw exception
   */
  @UseGuards(JwtAuthGuard)
  @Put('/update')
  updateGFF3File(@Body() postDto: GFF3ChangeLineObjectDto) {
    this.logger.debug(`Filename=${postDto.filename}`)
    this.logger.debug(`Original value=${JSON.stringify(postDto.originalLine)}`)
    this.logger.debug(`Updated value=${JSON.stringify(postDto.updatedLine)}`)
    return this.fileService.updateGFF3File(postDto)
  }

  // /**
  //  * Loads GFF3 file data into cache. Cache key is started from 0
  //  * @param filename - File to download
  //  * @returns
  //  */
  // @UseGuards(JwtAuthGuard)
  // @Get('/getgff3file/:filename')
  // getGff3File(@Param('filename') filename: string) {
  //   return this.fileService.loadGff3IntoCache(filename)
  // }

  // /**
  //  * Updates string (or whole line) in CACHE
  //  * @param postDto - Data Transfer Object that contains information about original string/line and updated string/line
  //  * @returns Return 'HttpStatus.OK' if update was successful
  //  * or if search string/line was not found in the file then return error message with HttpStatus.NOT_FOUND
  //  * or in case of error throw exception
  //  */
  // @UseGuards(JwtAuthGuard)
  // @Put('/updategff3')
  // updateGFF3Cache(@Body() postDto: GFF3ChangeLineObjectDto) {
  //   this.logger.verbose(
  //     `Original value=${JSON.stringify(postDto.originalLine)}`,
  //   )
  //   this.logger.verbose(`Updated value=${JSON.stringify(postDto.updatedLine)}`)

  //   return this.fileService.updateGFF3Cache(postDto)
  // }

  /**
   * Fetch features based on Reference seq, Start and End -values
   * @param request - Contain search criteria i.e. refname, start and end -parameters
   * @returns Return 'HttpStatus.OK' and array of features if search was successful
   * or if search data was not found or in case of error throw exception
   */
  @UseGuards(JwtAuthGuard)
  @Get('/getFeaturesByCriteria')
  getFeaturesByCriteria(@Req() request: Request) {
    this.logger.debug(
      `Seq_id=${request.query.seq_id}=, Start=${request.query.start}=, End=${request.query.end}=`,
    )

    const searchDto: GFF3FeatureLine = {
      seq_id: `${request.query.seq_id}`,
      start: parseInt(`${request.query.start}`, 10),
      end: parseInt(`${request.query.end}`, 10),
      source: null,
      type: null,
      score: null,
      strand: null,
      phase: null,
      attributes: null,
    }

    return this.fileService.getFeaturesByCriteria(searchDto)
  }

  /**
   * Fetch embedded FASTA sequence based on Reference seq, Start and End -values
   * @param request - Contain search criteria i.e. refname, start and end -parameters
   * @returns Return embedded FASTA sequence if search was successful
   * or if search data was not found or in case of error throw exception
   */
  @UseGuards(JwtAuthGuard)
  @Get('/getFastaByCriteria')
  getFastaByCriteria(@Req() request: Request) {
    this.logger.debug(
      `Seq_id=${request.query.seq_id}=, Start=${request.query.start}=, End=${request.query.end}=`,
    )

    const searchDto: GFF3FeatureLine = {
      seq_id: `${request.query.seq_id}`,
      start: parseInt(`${request.query.start}`, 10),
      end: parseInt(`${request.query.end}`, 10),
      source: null,
      type: null,
      score: null,
      strand: null,
      phase: null,
      attributes: null,
    }

    return this.fileService.getFastaByCriteria(searchDto)
  }

  /**
   * Get list of embedded FASTA sequences
   * @returns Return list of embedded FASTA sequences as array of fastaSequenceInfo -object
   * or if no data was found or in case of error throw exception
   */
  @UseGuards(JwtAuthGuard)
  @Get('/getFastaInfo')
  getFastaInfo() {
    return this.fileService.getFastaInfo()
  }

  /**
   * Get list of assemblies
   * @returns For now, returns a single hard-coded assembly
   */
  @UseGuards(JwtAuthGuard)
  @Get('/getAssemblies')
  getAssemblies() {
    return [
      {
        name: 'vvx',
        id: '0545a542-e565-440c-b2c5-52b208f58f6e',
        aliases: ['volvox'],
        displayName: 'Volvox mythicus',
      },
    ]
  }

  // /**
  //  * Save new uploaded file into local filesystem and then loads it into cache. The filename in local filesystem will be: 'uploaded' + timestamp in ddmmyyyy_hh24miss -format + original filename
  //  * You can call this endpoint like: curl http://localhost:3000/fileHandling/uploadtocache -F 'file=\@./save_this_file.txt' -F 'name=test'
  //  * @param file - File to save
  //  * @returns Return status 'HttpStatus.OK' if save was successful
  //  * or in case of error return throw exception
  //  */
  // @UseGuards(JwtAuthGuard)
  // @Post('/uploadtocache')
  // @UseInterceptors(FileInterceptor('file'))
  // async uploadFile(@UploadedFile() file: Express.Multer.File) {
  //   this.fileService.loadGFF3FileIntoCache(
  //     await this.fileService.saveNewFile(file),
  //   )
  // }

  /**
   * Download cache. First write cache into file and then download the file
   * @returns
   */
  // @UseGuards(JwtAuthGuard)
  @Get('/downloadcache')
  downloadCache() {
    this.logger.debug('Starting to write cache into file...')
    this.fileService.downloadCacheAsGFF3file().then((msg) => {
      this.logger.debug(`Now downloading file =${msg}`)
      const file = createReadStream(msg)
      return new StreamableFile(file)
    })
  }

  /**
   * Check if GFF3 is loaded into cache. Basically we check if number of entries is greater than 0 then GFF3 is loaded. Otherwise not
   * @returns TRUE: GFF3 is loaded into cache, otherwise return FALSE
   */
  @UseGuards(JwtAuthGuard)
  @Get('/checkcachekeys')
  checkCacheKeys() {
    this.logger.debug('Starting to check cache keys')
    return this.fileService.checkCacheKeys()
  }

  // /**
  //  * MONGOTEST ONLY
  //  */
  // @Get('/addgff3')
  // addGFF3(@Req() request: Request) {
  //   this.logger.debug(`Add GFF3....`)
  //   return this.fileService.insertGFF3()
  // }

  /**
   * MONGOTEST ONLY
   */
  //  @UseGuards(JwtAuthGuard)
  @Put('/updateMongo')
  updateMongo(@Body() postDto: UpdateEndObjectDto) {
    this.logger.debug(
      `Update Mongo document where featureId=${
        postDto.featureId
      } and old value=${JSON.stringify(
        postDto.oldEnd,
      )}. New value will be ${JSON.stringify(postDto.newEnd)}.`,
    )
    return this.fileService.updateEndPosInMongo(postDto)
  }
}
