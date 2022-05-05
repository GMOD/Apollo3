import { createHash } from 'crypto'
import { createReadStream, createWriteStream } from 'fs'
import { join } from 'path'
import { createGzip } from 'zlib'

import { InternalServerErrorException, Logger } from '@nestjs/common'
import { StorageEngine } from 'multer'

export class FileStorageEngine implements StorageEngine {
  private readonly logger = new Logger(FileStorageEngine.name)

  constructor(private readonly originalCheckSum: string) {}

  async _handleFile(
    req: Express.Request,
    file: Express.Multer.File,
    cb: (error?: unknown, info?: Partial<Express.Multer.File>) => void,
  ) {
    let fileChecksum = ''
    const newFullFileName = join('./test', file.originalname)
    const origCheckSum = this.originalCheckSum
    this.logger.debug(`Original file checksum: ${this.originalCheckSum}`)
    this.logger.debug(`Filename: ${file.originalname}`)
    this.logger.debug(`Mimetype: ${file.mimetype}`)
    const fileWriteStream = createWriteStream(newFullFileName)
    for await (const chunk of file.stream) {
      fileWriteStream.write(chunk)
    }
    await fileWriteStream.end()
    this.logger.debug(`Write data done`)

    // Check md5 checksum of saved file
    const hash = createHash('md5')
    const stream = createReadStream(newFullFileName)
    stream
      .on('data', function (data: string) {
        hash.update(data, 'utf8')
      })
      .on('end', function () {
        fileChecksum = hash.digest('hex')
        console.log(`checksum on ${fileChecksum}`)

        // Check that checksums match and compress the file
        if (fileChecksum === origCheckSum) {
          console.log(`Compressed the file...`)
          const compressStream = createReadStream(newFullFileName)
          compressStream
            .pipe(createGzip())
            .pipe(createWriteStream(`${newFullFileName}.gz`))
            .on('finish', () =>
              console.log(
                `Successfully compressed the file at ${newFullFileName}`,
              ),
            )
        } else {
          const errMsg = `Original file checksum '${origCheckSum}' did not match with saved file checksum '${fileChecksum}'`
          console.log(errMsg)
          throw new InternalServerErrorException(errMsg)
        }
      })
    this.logger.debug(`ReadStream done`)

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
