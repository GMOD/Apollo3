import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common'
import { createWriteStream, existsSync } from 'fs'
import { Response } from 'express'
import { fileSearchFolderConfig, uploadedFileConfig } from '../utils/fileConfig'
import { commonUtilities } from '../utils/commonUtilities'
import { join } from 'path/posix'

@Injectable()
export class FileHandlingService {
  private readonly logger = new Logger(FileHandlingService.name)
  private readonly commUtils = new commonUtilities()

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
    try {
      // Check if filesize is 0
      if (file.size < 1) {
        const msg = 'File ' + file.originalname + ' is empty!'
        this.logger.error(msg)
        return response
          .status(HttpStatus.INTERNAL_SERVER_ERROR)
          .json({ status: HttpStatus.INTERNAL_SERVER_ERROR, message: msg })
      }
      this.logger.debug(
        'Starting to save file ' +
          file.originalname +
          ', size=' +
          file.size +
          ' bytes.',
      )
      // Join path+filename
      const newFullFileName = join(
        uploadedFileConfig.outputFolder,
        'uploaded_' +
          this.commUtils.getCurrentDateTime() +
          '_' +
          file.originalname,
      )
      this.logger.debug('New file will be saved as ' + newFullFileName)

      // Save file
      const ws = createWriteStream(newFullFileName)
      ws.write(file.buffer)
      ws.close()
      return response.status(HttpStatus.OK).json({
        status: HttpStatus.OK,
        message: 'File ' + file.originalname + ' was saved',
      })
    } catch (err) {
      this.logger.error('ERROR when saving file: ' + err)
      // Delete file if it was already saved???
      throw new HttpException(
        'ERROR in saveNewFile() : ' + err,
        HttpStatus.INTERNAL_SERVER_ERROR,
      )
    }
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
      this.logger.debug('Check if file ' + newFullFileName + ' exists!')

      // Check if file exists
      if (existsSync(newFullFileName)) return true
    } catch (err) {
      this.logger.error('ERROR when checking if file exists: ' + err)
    }
    return false
  }
}
