/* eslint-disable @typescript-eslint/no-unnecessary-condition */
import {
  Body,
  Controller,
  Delete,
  Get,
  Head,
  Headers,
  Logger,
  Param,
  Post,
  Query,
  Req,
  Res,
  StreamableFile,
  UnprocessableEntityException,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express/multer'
import { Request, Response } from 'express'

import { Role } from '../utils/role/role.enum'
import { Validations } from '../utils/validation/validatation.decorator'
import { FilesService } from './files.service'
import {
  FileStorageEngine,
  UploadedFile as UploadedApolloFile,
} from './FileStorageEngine'

@Validations(Role.ReadOnly)
@Controller('files')
export class FilesController {
  constructor(private readonly filesService: FilesService) {}
  private readonly logger = new Logger(FilesController.name)

  @Validations(Role.Admin)
  @Head()
  filesHead() {
    return ''
  }

  /**
   * Stream file to server and check checksum
   * @param file - File to save
   * @returns Return ....  if save was successful
   * or in case of error return throw exception
   */
  @Validations(Role.Admin)
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
    this.logger.debug(
      `Upload file "${file.originalname}", checksum "${file.checksum}"`,
    )
    return this.filesService.create({
      basename: file.originalname,
      checksum: file.checksum,
      type: body.type,
      user: 'na',
    })
  }

  @Validations(Role.Admin)
  @Post('stream')
  async streamFile(
    @Req() req: Request,
    @Query('name') name: string,
    @Headers('Content-Length') contentLength: string,
    @Headers('Content-Type') contentType: 'text/x-gff3' | 'text/x-fasta',
  ) {
    let size = Number.parseInt(contentLength, 10)
    size = Number.isNaN(size) ? 0 : size
    const checksum = await this.filesService.uploadFileFromRequest(
      req,
      name,
      size,
    )
    return this.filesService.create({
      basename: name,
      checksum,
      type: contentType,
      user: 'na',
    })
  }

  /**
   * Download file from files -collection
   * @param id -
   * @returns
   */
  @Get(':id')
  async downloadFile(
    @Param('id') id: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const file = await this.filesService.findOne(id)
    this.logger.debug(
      `Streaming file '${file.basename}' from server to client'`,
    )
    this.logger.debug(`headers: ${JSON.stringify(req.headers)}`)
    const acceptEncodingHeader = req.headers['accept-encoding']
    const encodings =
      typeof acceptEncodingHeader === 'string'
        ? acceptEncodingHeader.split(',').map((s) => s.trim())
        : acceptEncodingHeader
    const acceptGzip = encodings?.includes('gzip')
    res.set({
      'Content-Type': file.type,
      'Content-Disposition': `attachment; filename="${file.basename}"`,
    })
    if (acceptGzip) {
      res.set({ 'Content-Encoding': 'gzip' })
      return new StreamableFile(this.filesService.getFileStream(file, true))
    }
    return new StreamableFile(this.filesService.getFileStream(file))
  }

  /**
   * Delete file from Files collection in Mongo. Check and see if that checksum is used elsewhere in the collection; if not, delete the file as well
   * @param id - fileId to be deleted
   * @returns
   */
  @Delete(':id')
  async remove(@Param('id') id: string) {
    this.logger.debug(`Delete fileId "${id}" from Mongo`)
    return this.filesService.remove(id)
  }
}
