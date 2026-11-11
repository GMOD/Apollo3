import { Readable } from 'node:stream'

import { File } from '@apollo-annotation/schemas'
import {
  Controller,
  Delete,
  Get,
  Head,
  Logger,
  Param,
  Post,
  Query,
  Req,
  Res,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import {
  ApiBody,
  ApiConsumes,
  ApiExcludeEndpoint,
  ApiOkResponse,
  ApiProduces,
  ApiQuery,
} from '@nestjs/swagger'
import type { Request, Response } from 'express'

import { FileStorageEngine } from './FileStorageEngine.js'
import { FilesInterceptor as StreamingFileInterceptor } from './files.interceptor.js'
import { FilesService } from './files.service.js'
import type { UploadedFile as UploadedApolloFile } from './filesUtil.js'

@Controller('files')
export class FilesController {
  constructor(private readonly filesService: FilesService) {}
  private readonly logger = new Logger(FilesController.name)

  /** List uploaded files */
  @ApiOkResponse({ type: [File] })
  @Get()
  findAll() {
    return this.filesService.findAll()
  }

  @ApiExcludeEndpoint()
  @Head()
  filesHead() {
    return ''
  }

  /**
   * Upload a GFF3 or FASTA file
   *
   * The file can be gzip-compressed. Returns the new file's record, whose ID
   * can be used in a change that adds an assembly or features from a file.
   */
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @ApiQuery({
    name: 'type',
    description: "The file's type",
    enum: ['text/x-gff3', 'text/x-fasta'],
  })
  @Post()
  @UseInterceptors(
    FileInterceptor('file', { storage: new FileStorageEngine() }),
    StreamingFileInterceptor,
  )
  async uploadFile(
    @UploadedFile() file: UploadedApolloFile,
    @Query('type') type: 'text/x-gff3' | 'text/x-fasta',
  ) {
    this.logger.debug(
      `Upload file "${file.originalname}", checksum "${file.checksum}"`,
    )
    return this.filesService.create({
      basename: file.originalname,
      checksum: file.checksum,
      type,
      user: 'na',
    })
  }

  /**
   * Download an uploaded file
   *
   * The file is gzip-compressed if the request's `Accept-Encoding` header
   * includes `gzip`.
   * @param id - File ID
   */
  @ApiProduces('text/x-gff3', 'text/x-fasta')
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
      return new StreamableFile(
        Readable.fromWeb(this.filesService.getFileStream(file, true)),
      )
    }
    return new StreamableFile(
      Readable.fromWeb(this.filesService.getFileStream(file)),
    )
  }

  /**
   * Delete an uploaded file
   *
   * The stored file is also removed if no other uploaded file has the same
   * checksum.
   * @param id - File ID
   */
  @Delete(':id')
  async remove(@Param('id') id: string) {
    this.logger.debug(`Delete fileId "${id}" from Mongo`)
    return this.filesService.remove(id)
  }
}
