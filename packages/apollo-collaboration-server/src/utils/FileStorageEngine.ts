import { createHash } from 'crypto'
import { createWriteStream, rename } from 'fs'
import { join } from 'path'
import { createGzip } from 'zlib'

import { Injectable, Logger } from '@nestjs/common'
import { StorageEngine } from 'multer'

import { getCurrentDateTime } from './commonUtilities'

@Injectable()
export class FileStorageEngine implements StorageEngine {
  private readonly logger = new Logger(FileStorageEngine.name)

  constructor(private readonly originalCheckSum: string) {}

  async _handleFile(
    req: Express.Request,
    file: Express.Multer.File,
    cb: (error?: unknown, info?: Partial<Express.Multer.File>) => void,
  ) {
    const { FILE_UPLOAD_FOLDER } = process.env
    if (!FILE_UPLOAD_FOLDER) {
      throw new Error('No FILE_UPLOAD_FOLDER found in .env file')
    }
    const tempFullFileName = join(
      FILE_UPLOAD_FOLDER,
      `${file.originalname}_${getCurrentDateTime()}.gz`,
    )
    this.logger.debug(`Original file checksum: ${this.originalCheckSum}`)
    this.logger.debug(`Filename: ${file.originalname}`)

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
    this.logger.debug(`finalFullFileName: ${finalFullFileName}`)
    await rename(tempFullFileName, finalFullFileName, (err) => {
      if (err) {
        throw new Error(`Error in renaming uploaded file: ${err}`)
      }
    })

    // // Add information into MongoDb
    // const mongoDoc: CreateFileDto = {
    //   basename: file.originalname,
    //   compressedFileName: file.originalname, // ************* MITEN TANNE SAA CHECKSUM TIEDON FILESTORAGEENGINE LUOKASTA ????  ***********
    //   checksum: 'body.checksum',
    //   type: 'body.type',
    //   user: 'na',
    // }
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
  }

  _removeFile(
    req: Express.Request,
    file: Express.Multer.File,
    cb: (error: Error | null) => void,
  ) {
    this.logger.debug(file)
  }
}
