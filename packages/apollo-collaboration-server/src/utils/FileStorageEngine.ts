import { createHash } from 'crypto'
import { createWriteStream } from 'fs'
import { mkdir, mkdtemp, rename, rmdir } from 'fs/promises'
import { join } from 'path'
import { pipeline } from 'stream/promises'
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
    const tmpDir = await mkdtemp(join(FILE_UPLOAD_FOLDER, 'upload-tmp-'))
    // First we need to write new file using temp name. After writing has completed then we rename the file to match with file checksum
    const tempFullFileName = join(tmpDir, `${file.originalname}.gz`)
    this.logger.debug(`User uploaded file: ${file.originalname}`)

    const hash = createHash('md5')
    file.stream.on('data', (chunk) => {
      hash.update(chunk, 'utf8')
      return chunk
    })

    // Check md5 checksum of saved file
    const fileWriteStream = createWriteStream(tempFullFileName)
    const gz = createGzip()
    await pipeline(file.stream, gz, fileWriteStream)
    this.logger.debug(`Compressed file: ${tempFullFileName}`)
    const fileChecksum = hash.digest('hex')
    this.logger.debug(`Uploaded file checksum: ${fileChecksum}`)
    const finalFullFileName = join(FILE_UPLOAD_FOLDER, fileChecksum)
    this.logger.debug(`FinalFullFileName: ${finalFullFileName}`)
    await rename(tempFullFileName, finalFullFileName)
    await rmdir(tmpDir)

    cb(null, { ...file, checksum: fileChecksum })
  }

  _removeFile(
    req: Express.Request,
    file: Express.Multer.File,
    cb: (error: Error | null) => void,
    // eslint-disable-next-line @typescript-eslint/no-empty-function
  ) {}
}
