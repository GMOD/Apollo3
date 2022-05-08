import { createReadStream } from 'fs'
import { join } from 'path'

import {
  Body,
  Controller,
  Get,
  Logger,
  Param,
  Post,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express/multer'

import { FileStorageEngine } from '../utils/FileStorageEngine'
import { CreateFileDto } from './dto/create-file.dto'
import { FilesService } from './files.service'

@Controller('files')
export class FilesController {
  constructor(private readonly filesService: FilesService) {}
  private readonly logger = new Logger(FilesController.name)

  /**
   * Stream GFF3 file to server and check checksum
   * You can call this endpoint like: curl http://localhost:3999/files/streamFile -F file=\@./volvox.sort.gff3  (add also checksum into body part....)
   * @param file - File to save
   * @returns Return ....  if save was successful
   * or in case of error return throw exception
   */
  @Post('/gff3')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: new FileStorageEngine('83d5568fdd38026c75a3aed528e9e81d'), // Here we should pass original file checksum that comes in from Request/Body/Query param
    }),
  )
  async streamGFF3File(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: any,
  ) {
    this.logger.debug(
      `Original GFF3 file checksum: '${body.checksum}', type : '${body.type}'`,
    )
    // Add information into MongoDb
    const mongoDoc: CreateFileDto = {
      basename: file.originalname,
      compressedFileName: file.originalname,  // ************* MITEN TANNE SAA CHECKSUM TIEDON FILESTORAGEENGINE LUOKASTA ????  ***********
      checksum: body.checksum,
      type: body.type,
      user: 'na',
    }
    this.filesService.create(mongoDoc)
    return 'GFF3 file saved'
  }

  /**
   * Get GFF3 file from server
   * @param filename - File to stream
   * @returns
   */
  @Get('/gff3/:filename')
  getGFF3File(@Param('filename') filename: string): StreamableFile {
    const { FILE_UPLOAD_FOLDER } = process.env
    if (!FILE_UPLOAD_FOLDER) {
      throw new Error('No FILE_UPLOAD_FOLDER found in .env file')
    }
    this.logger.debug(
      `Streaming GFF3 file '${filename}' from server to client'`,
    )
    const file = createReadStream(join(FILE_UPLOAD_FOLDER, filename))
    return new StreamableFile(file)
  }

  /**
   * Get FASTA file from server
   * @param filename - File to stream
   * @returns
   */
  @Get('/fasta/:filename')
  getFastaFile(@Param('filename') filename: string): StreamableFile {
    const { FILE_UPLOAD_FOLDER } = process.env
    if (!FILE_UPLOAD_FOLDER) {
      throw new Error('No FILE_UPLOAD_FOLDER found in .env file')
    }
    this.logger.debug(
      `Streaming FASTA file '${filename}' from server to client'`,
    )
    const file = createReadStream(join(FILE_UPLOAD_FOLDER, filename))
    return new StreamableFile(file)
  }
}
