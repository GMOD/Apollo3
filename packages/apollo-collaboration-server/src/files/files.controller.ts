import { createReadStream } from 'fs'
import { join } from 'path'
import { createGunzip } from 'zlib'

import {
  Body,
  Controller,
  Get,
  Logger,
  Param,
  Post,
  Request,
  Response,
  StreamableFile,
  UnprocessableEntityException,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express/multer'
import { Request as ExpressRequest, Response as ExpressResponse } from 'express'

import {
  FileStorageEngine,
  UploadedFile as UploadedApolloFile,
} from '../utils/FileStorageEngine'
import { FilesService } from './files.service'
import { JwtAuthGuard } from '../utils/jwt-auth.guard'

@Controller('files')
export class FilesController {
  constructor(private readonly filesService: FilesService) {}
  private readonly logger = new Logger(FilesController.name)

  /**
   * Stream file to server and check checksum
   * @param file - File to save
   * @returns Return ....  if save was successful
   * or in case of error return throw exception
   */
  @UseGuards(JwtAuthGuard)
  @Post()
  @UseInterceptors(
    FileInterceptor('file', { storage: new FileStorageEngine() }),
  )
  async uploadFile(
    @UploadedFile() file: UploadedApolloFile,
    @Body() body: { type: 'text/x-gff3' | 'text/x-fasta' },
  ) {
    if (!file) {
      throw new UnprocessableEntityException('No "file" found in request')
    }
    this.logger.debug(`Upload file alkaa...`)
    this.logger.debug(`Upload ${file.originalname}`)
    this.logger.debug(`Upload ${file.checksum}`)
    await this.filesService.create({
      basename: file.originalname,
      checksum: file.checksum,
      type: body.type,
      user: 'na',
    })
    return file.checksum
  }

  /**
   * Download file from files -collection
   * @param id -
   * @returns
   */
  @Get(':id')
  async downloadFile(
    @Param('id') id: string,
    @Request() req: ExpressRequest,
    @Response({ passthrough: true }) res: ExpressResponse,
  ): Promise<StreamableFile> {
    const file = await this.filesService.findOne(id)
    const { FILE_UPLOAD_FOLDER } = process.env
    if (!FILE_UPLOAD_FOLDER) {
      throw new Error('No FILE_UPLOAD_FOLDER found in .env file')
    }
    this.logger.debug(
      `Streaming file '${file.basename}' from server to client'`,
    )
    this.logger.debug(`headers: ${JSON.stringify(req.headers)}`)
    const acceptEncodingHeader = req.headers['accept-encoding']
    const encodings =
      typeof acceptEncodingHeader === 'string'
        ? acceptEncodingHeader.split(',').map((s) => s.trim())
        : acceptEncodingHeader
    const acceptGzip = encodings && encodings.includes('gzip')
    res.set({
      'Content-Type': file.type,
      'Content-Disposition': `attachment; filename="${file.basename}"`,
    })
    const fileStream = createReadStream(join(FILE_UPLOAD_FOLDER, file.checksum))
    if (acceptGzip) {
      res.set({ 'Content-Encoding': 'gzip' })
      return new StreamableFile(fileStream)
    }
    const gunzip = createGunzip()
    return new StreamableFile(fileStream.pipe(gunzip))
  }
}
