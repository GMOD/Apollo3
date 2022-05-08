import { createWriteStream } from 'fs'
import { join } from 'path'
import { createGzip } from 'zlib'

import { Injectable, Logger } from '@nestjs/common'
import { StorageEngine } from 'multer'

import { getCurrentDateTime } from './commonUtilities'

@Injectable()
export class FileStorageEngine implements StorageEngine {
  private readonly logger = new Logger(FileStorageEngine.name)

  constructor(
    private readonly originalCheckSum: string, // private readonly timeStamp: string
  ) {}

  async _handleFile(
    req: Express.Request,
    file: Express.Multer.File,
    cb: (error?: unknown, info?: Partial<Express.Multer.File>) => void,
  ) {
    const { FILE_UPLOAD_FOLDER } = process.env
    if (!FILE_UPLOAD_FOLDER) {
      throw new Error('No FILE_UPLOAD_FOLDER found in .env file')
    }
    const newFullFileName = join(
      FILE_UPLOAD_FOLDER,
      `${file.originalname}_${getCurrentDateTime()}.gz`,
    )
    this.logger.debug(`Original file checksum: ${this.originalCheckSum}`)
    this.logger.debug(`Filename: ${file.originalname}`)
    this.logger.debug(`Mimetype: ${file.mimetype}`)

    const fileWriteStream = createWriteStream(newFullFileName)
    const gz = createGzip()
    gz.pipe(fileWriteStream)
    for await (const chunk of file.stream) {
      gz.write(chunk)
    }
    gz.end()
    this.logger.debug(`Compressed file: ${newFullFileName}`)

    // new FilesService(new Model<UserFileDocument>()).create(mongoDoc)
    // te.create(mongoDoc)
    // this.filesService.create(mongoDoc)
    // this.logger.debug(`Add uploaded file info into Mongo: ${JSON.stringify(mongoDoc)}`)
    // this.FileModel.create(mongoDoc)
    // this.logger.debug(`Added document into Mongo`)

    // // **** TODO: Later we need to implement to a way to check original file checksum vs. saved file checksum.
    // const origCheckSum = this.originalCheckSum
    // let fileChecksum = ''
    // const fileWriteStream = createWriteStream(newFullFileName)
    // for await (const chunk of file.stream) {
    //   fileWriteStream.write(chunk)
    // }
    // // Check md5 checksum of saved file
    // const hash = createHash('md5')
    // const stream = createReadStream(newFullFileName)
    // stream
    //   .on('data', function (data: string) {
    //     hash.update(data, 'utf8')
    //   })
    //   .on('end', function () {
    //     fileChecksum = hash.digest('hex')
    //     console.log(`checksum on ${fileChecksum}`)

    //     // Check that checksums match and compress the file
    //     if (fileChecksum === origCheckSum) {
    //       console.log(`Compressed the file...`)
    //       const compressStream = createReadStream(newFullFileName)
    //       compressStream
    //         .pipe(createGzip())
    //         .pipe(createWriteStream(`${newFullFileName}.gz`))
    //         .on('finish', () =>
    //           console.log(
    //             `Successfully compressed the file at ${newFullFileName}`,
    //           ),
    //         )
    //     } else {
    //       const errMsg = `Original file checksum '${origCheckSum}' did not match with saved file checksum '${fileChecksum}'`
    //       console.log(errMsg)
    //       throw new InternalServerErrorException(errMsg)
    //     }
    //   })

    cb(null, file)
    return 'juuu'
  }

  _removeFile(
    req: Express.Request,
    file: Express.Multer.File,
    cb: (error: Error | null) => void,
  ) {
    this.logger.debug(file)
  }
}
