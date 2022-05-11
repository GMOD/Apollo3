import { createHash } from 'crypto'
import { createWriteStream, rename } from 'fs'
import { join } from 'path'
import { createGzip } from 'zlib'

import { Injectable, Logger } from '@nestjs/common'
import { StorageEngine } from 'multer'

@Injectable()
export class FileStorageEngine implements StorageEngine {
  private readonly logger = new Logger(FileStorageEngine.name)

  async _handleFile(
    req: Express.Request,
    file: Express.Multer.File,
    cb: (error?: unknown, info?: Partial<Express.Multer.File>) => void,
  ) {
    const { FILE_UPLOAD_FOLDER } = process.env
    if (!FILE_UPLOAD_FOLDER) {
      throw new Error('No FILE_UPLOAD_FOLDER found in .env file')
    }
    // First we need to write new file using temp name. After writing has completed then we rename the file to match with file checksum
    const tempFullFileName = join(FILE_UPLOAD_FOLDER, `${file.originalname}.gz`)
    this.logger.debug(`User uploaded file: ${file.originalname}`)

    // Check md5 checksum of saved file
    const hash = createHash('md5')
    const fileWriteStream = createWriteStream(tempFullFileName)
    const gz = createGzip()
    gz.pipe(fileWriteStream)
    for await (const chunk of file.stream) {
      gz.write(chunk)
      hash.update(chunk, 'utf8')
    }
    gz.end()
    this.logger.debug(`Compressed file: ${tempFullFileName}`)
    const fileChecksum = hash.digest('hex')
    this.logger.debug(`Uploaded file checksum: ${fileChecksum}`)
    const finalFullFileName = join(FILE_UPLOAD_FOLDER, `${fileChecksum}.gz`)
    this.logger.debug(`FinalFullFileName: ${finalFullFileName}`)
    rename(tempFullFileName, finalFullFileName, (err) => {
      if (err) {
        throw new Error(`Error in renaming uploaded file: ${err}`)
      }
    })
    file.filename = fileChecksum

    cb(null, file)
  }

  _removeFile(
    req: Express.Request,
    file: Express.Multer.File,
    cb: (error: Error | null) => void,
  ) {
    this.logger.debug(file)
  }
}
