import { createReadStream } from 'fs'
import { join } from 'path'

import { GFF3SequenceRegionDirective } from '@gmod/gff/dist/util'
import {
  Body,
  Controller,
  Get,
  Headers,
  InternalServerErrorException,
  Logger,
  Param,
  Post,
  Put,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express/multer'
import { Request, Response } from 'express'

import { GFF3ChangeLineObjectDto } from '../entity/gff3Object.dto'
import { JwtAuthGuard } from '../utils/jwt-auth.guard'
import { FileHandlingService } from './fileHandling.service'

@Controller('fileHandling')
export class FileHandlingController {
  constructor(private readonly fileService: FileHandlingService) {}
  private readonly logger = new Logger(FileHandlingController.name)

  // /**
  //  * THIS IS JUST FOR DEMO PURPOSE
  //  * Save new uploaded file into local filesystem. The filename in local filesystem will be: 'uploaded' + timestamp in ddmmyyyy_hh24miss -format + original filename
  //  * You can call this endpoint like: curl http://localhost:3000/fileHandling/upload -F 'file=@./save_this_file.txt' -F 'name=test'
  //  * @param file File to save
  //  * @returns Return status 'HttpStatus.OK' if save was successful
  //  * or in case of error return throw exception
  //  */
  // // @UseGuards(JwtAuthGuard)
  // // @Roles(Role.User) // This value is for demo only
  // @Post('/upload')
  // @UseInterceptors(FileInterceptor('file'))
  // async uploadFile(@UploadedFile() file: Express.Multer.File) {
  //   return this.fileService.saveNewFile(file)
  // }

  /**
   * THIS IS JUST FOR DEMO PURPOSE
   * Download file from server to client. The given filename must exists in pre-defined folder (see fileConfig.ts)
   * You can call this endpoint like: curl http://localhost:3000/fileHandling/getfile/your_filename.txt
   * @param filename File to download
   * @param res
   * @returns
   */
  @Get('/getfile/:filename')
  getFile(@Param('filename') filename: string, @Res() res: Response) {
    // Check if file exists
    if (!this.fileService.fileExists(filename)) {
      this.logger.error(
        `File =${filename}= does not exist in folder =${process.env.FILE_SEARCH_FOLDER}=`,
      )
      throw new InternalServerErrorException(`File ${filename} does not exist!`)
    }
    this.logger.debug(`Starting to download file ${filename}`)

    // Download file
    const file = createReadStream(
      join(process.env.FILE_SEARCH_FOLDER, filename),
    )
    return file.pipe(res)
  }

  // /**
  //  * THIS IS JUST FOR DEMO PURPOSE
  //  * Updates string (or whole line) in existing file
  //  * @param id Filename to be updated
  //  * @param postDto Data Transfer Object that contains information about original string/line and updated string/line
  //  * @param res
  //  * @returns Return 'HttpStatus.OK' if update was successful
  //  * or if search string/line was not found in the file then return error message with HttpStatus.NOT_FOUND
  //  * or in case of error return throw exception
  //  */
  // @Put('/updategff3/:id')
  // updateGFF3Cache(
  //   @Param('id') id: string,
  //   @Body() postDto: gff3ChangeLineObjectDto,
  //   @Res() res: Response,
  // ) {
  //   this.logger.verbose(
  //     'Original value=' + JSON.stringify(postDto.originalLine),
  //   )
  //   this.logger.verbose('Updated value=' + JSON.stringify(postDto.updatedLine))
  //   return this.fileService.updateGFF3Cache(id, postDto, res)
  // }

  /**
   * THIS IS JUST FOR DEMO PURPOSE
   * Updates string (or whole line) in existing file
   * @param id Filename to be updated
   * @param postDto Data Transfer Object that contains information about original string/line and updated string/line
   * @returns Return 'HttpStatus.OK' if update was successful
   * or if search string/line was not found in the file then return error message with HttpStatus.NOT_FOUND
   * or in case of error return throw exception
   */
  @Put('/update')
  updateGFF3File(@Body() postDto: GFF3ChangeLineObjectDto) {
    this.logger.debug(`Filename=${postDto.filename}`)
    this.logger.debug(`Original value=${JSON.stringify(postDto.originalLine)}`)
    this.logger.debug(`Updated value=${JSON.stringify(postDto.updatedLine)}`)
    return this.fileService.updateGFF3File(postDto)
  }

  /**
   * THIS IS JUST FOR DEMO PURPOSE
   * Loads GFF3 file data into cache. Cache key is started from 0
   * @param filename File to download
   * @returns
   */
  @Get('/getgff3file/:filename')
  getGff3File(@Param('filename') filename: string) {
    return this.fileService.loadGff3IntoCache(filename)
  }

  /**
   * Updates string (or whole line) in CACHE
   * @param postDto Data Transfer Object that contains information about original string/line and updated string/line
   * @param res
   * @returns Return 'HttpStatus.OK' if update was successful
   * or if search string/line was not found in the file then return error message with HttpStatus.NOT_FOUND
   * or in case of error throw exception
   */
  @Put('/updategff3')
  updateGFF3Cache(@Body() postDto: GFF3ChangeLineObjectDto) {
    this.logger.verbose(
      `Original value=${JSON.stringify(postDto.originalLine)}`,
    )
    this.logger.verbose(`Updated value=${JSON.stringify(postDto.updatedLine)}`)

    return this.fileService.updateGFF3Cache(postDto)
  }

  // /**
  //  * Fetch features based on Reference seq, Start and End -values
  //  * @param searchDto Data Transfer Object that contains information about searchable region
  //  * @param res
  //  * @returns Return 'HttpStatus.OK' and array of features if search was successful
  //  * or if search data was not found or in case of error throw exception
  //  */
  // @Get('/getFeaturesByCriteria')
  // getFeaturesByCriteria(
  //   @Body() searchDto: RegionSearchObjectDto,
  //   @Res() res: Response,
  // ) {
  //   return this.fileService.getFeaturesByCriteria(searchDto, res)
  // }

  /**
   * Fetch features based on Reference seq, Start and End -values
   * @param request Constain search criteria i.e. refname, start and end -parameters
   * @returns Return 'HttpStatus.OK' and array of features if search was successful
   * or if search data was not found or in case of error throw exception
   */
  @Get('/getFeaturesByCriteria')
  getFeaturesByCriteria(@Req() request: Request) {
    this.logger.debug(`Seq_id=${request.query.seq_id}=`)
    this.logger.debug(`Start=${request.query.start}=`)
    this.logger.debug(`End=${request.query.end}=`)

    const searchDto: GFF3SequenceRegionDirective = {
      value: null,
      seq_id: `${request.query.seq_id}`,
      start: `${request.query.start}`,
      end: `${request.query.end}`,
      directive: null,
    }
    return this.fileService.getFeaturesByCriteria(searchDto)
  }

  // /**
  //  * Fetch embedded FASTA sequence based on Reference seq, Start and End -values
  //  * @param searchDto Data Transfer Object that contains information about searchable sequence
  //  * @param res
  //  * @returns Return 'HttpStatus.OK' and embedded FASTA sequence if search was successful
  //  * or if search data was not found or in case of error throw exception
  //  */
  // @Get('/getFastaByCriteria')
  // getFastaByCriteria(
  //   @Body() searchDto: RegionSearchObjectDto,
  //   @Res() res: Response,
  // ) {
  //   return this.fileService.getFastaByCriteria(searchDto, res)
  // }

  /**
   * Fetch embedded FASTA sequence based on Reference seq, Start and End -values
   * @param request Constain search criteria i.e. refname, start and end -parameters
   * @returns Return embedded FASTA sequence if search was successful
   * or if search data was not found or in case of error throw exception
   */
  @Get('/getFastaByCriteria')
  getFastaByCriteria(@Req() request: Request) {
    this.logger.debug(`Refname=${request.query.seq_id}=`)
    this.logger.debug(`Start=${request.query.start}=`)
    this.logger.debug(`End=${request.query.end}=`)

    // const searchDto: GFF3SequenceRegionDirective = {
    //   seq_id: `${request.query.seq_id}`,
    //   start: parseInt(`${request.query.start}`, 10),
    //   end: parseInt(`${request.query.end}`, 10),
    // }
    const searchDto: GFF3SequenceRegionDirective = {
      value: null,
      seq_id: `${request.query.seq_id}`,
      start: `${request.query.start}`,
      end: `${request.query.end}`,
      directive: null,
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
  getFastaInfo(@Headers() headers) {
    return this.fileService.getFastaInfo()
  }

  /**
   * Save new uploaded file into local filesystem and then loads it into cache. The filename in local filesystem will be: 'uploaded' + timestamp in ddmmyyyy_hh24miss -format + original filename
   * You can call this endpoint like: curl http://localhost:3000/fileHandling/uploadtocache -F 'file=@./save_this_file.txt' -F 'name=test'
   * @param file File to save
   * @returns Return status 'HttpStatus.OK' if save was successful
   * or in case of error return throw exception
   */
  // @UseGuards(JwtAuthGuard)
  // @Roles(Role.User)
  @Post('/uploadtocache')
  @UseInterceptors(FileInterceptor('file'))
  uploadFile(@UploadedFile() file: Express.Multer.File) {
    const tmpFileName = this.fileService.saveNewFile(file)
    this.fileService.loadGFF3FileIntoCache(tmpFileName)
  }

  /**
   * Download cache. First write cache into file and then download the file
   * @param res
   * @returns
   */
  @Get('/downloadcache')
  downloadCache(@Res() res: Response) {
    this.logger.debug('Starting to write cache into file...')
    this.fileService.downloadCacheAsGFF3file().then((msg) => {
      this.logger.debug(`Now downloading file =${msg}`)
      const file = createReadStream(msg)
      return file.pipe(res)
    })
  }

  /**
   * Check if GFF3 is loaded into cache. Basically we check if number of entries > 0 then GFF3 is loaded. Otherwise not
   * @param res
   * @returns TRUE: GFF3 is loaded into cache, otherwise return FALSE
   */
  @Get('/checkcachekeys')
  checkCacheKeys() {
    this.logger.debug('Starting to check cache keys')
    return this.fileService.checkCacheKeys()
  }
}
