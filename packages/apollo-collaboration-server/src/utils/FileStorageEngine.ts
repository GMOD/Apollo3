import { createWriteStream } from 'fs'
import { join } from 'path'
import { createGzip } from 'zlib'

import { Injectable, Logger } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
// import { UserFile, UserFileDocument } from 'apollo-schemas'
import { Assembly, AssemblyDocument } from 'apollo-schemas'
import { Model } from 'mongoose'
import { StorageEngine } from 'multer'

import { CreateFileDto } from '../files/dto/create-file.dto'
import { FilesService } from '../files/files.service'

@Injectable()
export class FileStorageEngine implements StorageEngine {
  private readonly logger = new Logger(FileStorageEngine.name)

  constructor(
    private readonly originalCheckSum: string, 
    @InjectModel(Assembly.name)
    private readonly UserFileModel: Model<AssemblyDocument>,
    // private readonly filesService: FilesService,
  ) {}
  // constructor(private readonly originalCheckSum: string) {}

  async _handleFile(
    req: Express.Request,
    file: Express.Multer.File,
    cb: (error?: unknown, info?: Partial<Express.Multer.File>) => void,
  ) {
    const { FILE_UPLOAD_FOLDER } = process.env
    if (!FILE_UPLOAD_FOLDER) {
      throw new Error('No FILE_UPLOAD_FOLDER found in .env file')
    }
    const newFullFileName = join(FILE_UPLOAD_FOLDER, file.originalname)
    this.logger.debug(`Original file checksum: ${this.originalCheckSum}`)
    this.logger.debug(`Filename: ${file.originalname}`)
    this.logger.debug(`Mimetype: ${file.mimetype}`)

    const fileWriteStream = createWriteStream(`${newFullFileName}.gz`)
    const gz = createGzip()
    gz.pipe(fileWriteStream)
    for await (const chunk of file.stream) {
      gz.write(chunk)
    }
    gz.end()
    this.logger.debug(`Compressed file: ${newFullFileName}.gz`)

    // Add information into MongoDb
    const mongoDoc: CreateFileDto = {
      basename: file.originalname,
      checksum: this.originalCheckSum,
      type: file.mimetype,
      user: 'na',
    }
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
