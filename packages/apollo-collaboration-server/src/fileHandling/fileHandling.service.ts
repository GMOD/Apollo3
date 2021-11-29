import { createWriteStream, existsSync } from 'fs'
import { join } from 'path/posix'

import {
  HttpException,
  HttpStatus,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common'
import { Response } from 'express'

import { CommonUtilities } from '../utils/commonUtilities'
import { fileSearchFolderConfig, uploadedFileConfig } from '../utils/fileConfig'

@Injectable()
export class FileHandlingService {
  private readonly logger = new Logger(FileHandlingService.name)
  private readonly commUtils = new CommonUtilities()

  /**
   * Save new uploaded file into local filesystem. The filename in local filesystem will be: 'uploaded' + timestamp in ddmmyyyy_hh24miss -format + original filename
   * @param newUser New user information
   * @param response
   * @returns Return 'HttpStatus.OK' if save was successful
   * or in case of error return error message with 'HttpStatus.INTERNAL_SERVER_ERROR'
   */
  async saveNewFile(
    file: Express.Multer.File,
    response: Response,
  ): Promise<Response> {
    // Check if filesize is 0
    if (file.size < 1) {
      const msg = `File ${file.originalname} is empty!`
      this.logger.error(msg)
      throw new InternalServerErrorException(msg)
    }
    this.logger.debug(
      `Starting to save file ${file.originalname}, size=${file.size} bytes.`,
    )
    // Join path+filename
    const newFullFileName = join(
      uploadedFileConfig.outputFolder,
      `uploaded_${this.commUtils.getCurrentDateTime()}_${file.originalname}`,
    )
    this.logger.debug(`New file will be saved as ${newFullFileName}`)

    // Save file
    const ws = createWriteStream(newFullFileName)
    ws.write(file.buffer)
    ws.close()
    return response.status(HttpStatus.OK).json({
      status: HttpStatus.OK,
      message: `File ${file.originalname} was saved`,
    })
  }

  /**
   * Check if given filename exists in default folder
   * @param filename New user information
   * @param response
   * @returns Return 'HttpStatus.OK' if save was successful
   * or in case of error return error message with 'HttpStatus.INTERNAL_SERVER_ERROR'
   */
  fileExists(filename: string): boolean {
    try {
      // Join path+filename
      const newFullFileName = join(
        fileSearchFolderConfig.searchFolder,
        filename,
      )
      this.logger.debug(`Check if file ${newFullFileName} exists!`)

      // Check if file exists
      if (existsSync(newFullFileName)) {
        return true
      }
    } catch (err) {
      this.logger.error(`ERROR when checking if file exists: ${err}`)
    }
    return false
  }
}
