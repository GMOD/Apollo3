import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common'
import { StorageEngine } from 'multer'

import { writeFileAndCalculateHash } from './filesUtil'

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
      cb(
        new InternalServerErrorException(
          'No FILE_UPLOAD_FOLDER found in .env file',
        ),
      )
      return
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
