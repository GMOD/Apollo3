import { createHash } from 'crypto'
import { createWriteStream } from 'fs'
import { mkdir, rename } from 'fs/promises'
import { join } from 'path'
import { createGzip } from 'zlib'

import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common'
import { StorageEngine } from 'multer'

export interface UploadedFile extends Express.Multer.File {
  checksum: string
}

@Injectable()
export class FileStorageEngine implements StorageEngine {
  private readonly logger = new Logger(FileStorageEngine.name)

  async _handleFile(
    req: Express.Request,
    file: Express.Multer.File,
    cb: (error?: unknown, info?: UploadedFile) => void,
  ) {
    const { FILE_UPLOAD_FOLDER } = process.env
    if (!FILE_UPLOAD_FOLDER) {
      return cb(
        new InternalServerErrorException(
          'No FILE_UPLOAD_FOLDER found in .env file',
        ),
      )
    }
    await mkdir(FILE_UPLOAD_FOLDER, { recursive: true })
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
    fileWriteStream.on('close', async () => {
      this.logger.debug(`Compressed file: ${tempFullFileName}`)
      const fileChecksum = hash.digest('hex')
      this.logger.debug(`Uploaded file checksum: ${fileChecksum}`)
      const finalFullFileName = join(FILE_UPLOAD_FOLDER, fileChecksum)
      this.logger.debug(`FinalFullFileName: ${finalFullFileName}`)
      await rename(tempFullFileName, finalFullFileName)

      cb(null, { ...file, checksum: fileChecksum })
    })
  }

  _removeFile(
    req: Express.Request,
    file: Express.Multer.File,
    cb: (error: Error | null) => void,
    // eslint-disable-next-line @typescript-eslint/no-empty-function
  ) {}
}
