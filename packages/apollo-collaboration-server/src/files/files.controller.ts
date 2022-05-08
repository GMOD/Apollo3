import {
  Body,
  Controller,
  Logger,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express/multer'
import { Model } from 'mongoose'
import { AssemblyDocument } from 'apollo-schemas'

import { FileStorageEngine } from '../utils/FileStorageEngine'
import { FilesService } from './files.service'

@Controller('files')
export class FilesController {
  constructor(private readonly filesService: FilesService) {}
  private readonly logger = new Logger(FilesController.name)
  //   private readonly fileServ = this?.filesService?

  /**
   * Stream file to server and check checksum
   * You can call this endpoint like: curl http://localhost:3999/files/streamFile -F file=\@./volvox.sort.gff3  (add also checksum into body part....)
   * @param file - File to save
   * @returns Return ....  if save was successful
   * or in case of error return throw exception
   */
  @Post('streamFile')
  @UseInterceptors(
    FileInterceptor('file', {
        storage: new FileStorageEngine('83d5568fdd38026c75a3aed528e9e81d', new Model<AssemblyDocument>()), // Here we should pass original file checksum that comes in from Request/Body/Query param
        // storage: new FileStorageEngine(new Model<UserFileDocument>(), '83d5568fdd38026c75a3aed528e9e81d'), // Here we should pass original file checksum that comes in from Request/Body/Query param
        // storage: new FileStorageEngine('83d5568fdd38026c75a3aed528e9e81d', new FilesService(new Model<FileDocument>())), // Here we should pass original file checksum that comes in from Request/Body/Query param
    //   storage: new FileStorageEngine('83d5568fdd38026c75a3aed528e9e81d'), // Here we should pass original file checksum that comes in from Request/Body/Query param
    }),
  )
  async streamFile(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: JSON,
  ) {
    // const values = Object.values(body)
    // this.logger.debug(`Original file checksum: '${values[0]}'`)
    return 'File saved'
  }
}
