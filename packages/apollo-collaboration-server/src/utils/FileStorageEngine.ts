import { createWriteStream } from 'fs'

import { StorageEngine } from 'multer'
import { join } from 'path'

export class FileStorageEngine implements StorageEngine {
  async _handleFile(
    req: Express.Request,
    file: Express.Multer.File,
    cb: (error?: unknown, info?: Partial<Express.Multer.File>) => void,
  ) {
    const newFullFileName = join('./test', 'dummy123.txt')
    console.log(`************* HANDLE FILE ALKAA *********** ${newFullFileName}`)
    const fileWriteStream = createWriteStream(newFullFileName)
    for await (const chunk of file.stream) {
      fileWriteStream.write(chunk)
    }
    fileWriteStream.end()
    cb(null, file)
    console.log('************* HANDLE FILE FINISHED ***********')
  }

  _removeFile(
    req: Express.Request,
    file: Express.Multer.File,
    cb: (error: Error | null) => void,
  ) {
    console.log(file)
  }
}
