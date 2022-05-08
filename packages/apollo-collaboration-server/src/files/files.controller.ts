import {
  Body,
  Controller,
  Logger,
  Post,
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
   * Stream file to server and check checksum
   * You can call this endpoint like: curl http://localhost:3999/files/streamFile -F file=\@./volvox.sort.gff3  (add also checksum into body part....)
   * @param file - File to save
   * @returns Return ....  if save was successful
   * or in case of error return throw exception
   */
  @Post('streamFile')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: new FileStorageEngine('83d5568fdd38026c75a3aed528e9e81d'), // Here we should pass original file checksum that comes in from Request/Body/Query param
    }),
  )
  async streamFile(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: JSON,
  ) {
    const values = Object.values(body)
    this.logger.debug(`Original file checksum: '${values[0]}'`)
    // Add information into MongoDb
    const mongoDoc: CreateFileDto = {
      basename: file.originalname,
      compressedFileName: file.originalname, // Here we may need to add more unique suffix (userstamp / timestamp etc.) to make filename unique to avoid overwriting
      checksum: values[0],
      type: file.mimetype,
      user: 'na',
    }
    this.filesService.create(mongoDoc)
    return 'File saved'
  }
}
