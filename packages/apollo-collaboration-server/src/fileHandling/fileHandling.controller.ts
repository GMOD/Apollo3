import {
  Controller,
  Get,
  HttpStatus,
  InternalServerErrorException,
  Logger,
  Param,
  Post,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common'
import { FileHandlingService } from './fileHandling.service'
import { FileInterceptor } from '@nestjs/platform-express/multer'
import { Response } from 'express'
import { createReadStream } from 'fs'
import { join } from 'path'
import { fileSearchFolderConfig } from '../utils/fileConfig'

@Controller('fileHandling')
export class FileHandlingController {
  constructor(private readonly fileService: FileHandlingService) {}
  private readonly logger = new Logger(FileHandlingController.name)

  /**
   * Save new uploaded file into local filesystem. The filename in local filesystem will be: 'uploaded' + timestamp in ddmmyyyy_hh24miss -format + original filename
   * You can call this endpoint like: curl http://localhost:3000/fileHandling/upload -F 'file=@./save_this_file.txt' -F 'name=test'
   * @param file File to save
   * @param response
   * @returns Return status 'HttpStatus.OK' if save was successful
   * or in case of error return error message with 'HttpStatus.INTERNAL_SERVER_ERROR'
   */
  // @UseGuards(JwtAuthGuard)
  // @Roles(Role.User) // This value is for demo only
  @Post('/upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @Res() response: Response,
  ) {
    return this.fileService.saveNewFile(file, response)
  }

  /**
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
        'File =' +
          filename +
          '= does not exist in folder =' +
          fileSearchFolderConfig.searchFolder +
          '=',
      )
      throw new InternalServerErrorException(
        'File ' + filename + ' does not exist!',
      )
    }
    this.logger.debug('Starting to download file ' + filename)

    // Download file
    const file = createReadStream(
      join(fileSearchFolderConfig.searchFolder, filename),
    )
    return file.pipe(res)
  }
}
