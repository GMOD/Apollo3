import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common'
import { type StorageEngine } from 'multer'

import { writeFileAndCalculateHash } from './filesUtil.js'

export interface UploadedFile extends Express.Multer.File {
  checksum: string
}

export interface FileUpload extends Express.Multer.File {
  contentEncoding?: string
}

@Injectable()
export class FileStorageEngine implements StorageEngine {
  private readonly logger = new Logger(FileStorageEngine.name)

  private contentEncoding?: string

  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  async _handleFile(
    req: Express.Request,
    file: FileUpload,
    cb: (error?: unknown, info?: UploadedFile) => void,
  ) {
    const { FILE_UPLOAD_FOLDER } = process.env
    if (!FILE_UPLOAD_FOLDER) {
      cb(
        new InternalServerErrorException(
          'No FILE_UPLOAD_FOLDER found in .env file',
        ),
      )
      return
    }
    if (file.originalname.toLocaleLowerCase().endsWith('.gz')) {
      file.contentEncoding = 'gzip'
    }

    const checksum = await writeFileAndCalculateHash(
      file,
      FILE_UPLOAD_FOLDER,
      this.logger,
    )

    cb(null, { ...file, checksum })
  }

  _removeFile(
    _req: Express.Request,
    _file: Express.Multer.File,
    _cb: (error: Error | null) => void,
    // eslint-disable-next-line @typescript-eslint/no-empty-function
  ) {}
}
