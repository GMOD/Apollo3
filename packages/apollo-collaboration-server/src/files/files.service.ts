import { ReadStream, createReadStream } from 'node:fs'
import { unlink } from 'node:fs/promises'
import { join } from 'node:path'
import { Gunzip, createGunzip } from 'node:zlib'

import { File, FileDocument } from '@apollo-annotation/apollo-schemas'
import gff from '@gmod/gff'
import {
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { InjectModel } from '@nestjs/mongoose'
import { Model } from 'mongoose'

import { CreateFileDto } from './dto/create-file.dto'

@Injectable()
export class FilesService {
  constructor(
    @InjectModel(File.name)
    private readonly fileModel: Model<FileDocument>,
    private readonly configService: ConfigService<
      { FILE_UPLOAD_FOLDER: string },
      true
    >,
  ) {}

  private readonly logger = new Logger(FilesService.name)

  create(createFileDto: CreateFileDto) {
    this.logger.debug(
      `Add uploaded file info into Mongo: ${JSON.stringify(createFileDto)}`,
    )
    return this.fileModel.create(createFileDto)
  }

  async findOne(id: string) {
    const file = await this.fileModel.findById(id).exec()
    if (!file) {
      throw new NotFoundException(`File with id "${id}" not found`)
    }
    return file
  }

  getFileStream<T extends boolean>(
    file: FileDocument,
    compressed: T,
  ): T extends true ? Gunzip : ReadStream
  getFileStream(file: FileDocument): ReadStream
  getFileStream(file: FileDocument, compressed = false) {
    const fileUploadFolder = this.configService.get('FILE_UPLOAD_FOLDER', {
      infer: true,
    })
    const fileStream = createReadStream(join(fileUploadFolder, file.checksum))
    if (compressed) {
      return fileStream
    }
    const gunzip = createGunzip()
    return fileStream.pipe(gunzip)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  parseGFF3(stream: ReadStream): any {
    return stream.pipe(
      gff.parseStream({
        parseSequences: false,
        parseComments: false,
        parseDirectives: false,
        parseFeatures: true,
      }),
    )
  }

  /**
   * Delete file from Files collection in Mongo. Check and see if that checksum is used elsewhere in the collection; if not, delete the file as well
   * @param id - fileId to be deleted
   * @returns
   */
  async remove(id: string) {
    const file = await this.fileModel.findById(id).exec()
    if (!file) {
      throw new NotFoundException(`File with id "${id}" not found`)
    }
    await this.fileModel.findByIdAndDelete(id).exec()

    // If same file is not used anywhere else then we delete the file from server folder
    const otherFiles = await this.fileModel
      .findOne({ checksum: file.checksum })
      .exec()
    if (!otherFiles) {
      const fileUploadFolder = this.configService.get('FILE_UPLOAD_FOLDER', {
        infer: true,
      })
      const compressedFullFileName = join(fileUploadFolder, file.checksum)
      this.logger.debug(
        `Delete the file "${compressedFullFileName}" from server folder`,
      )

      try {
        await unlink(compressedFullFileName)
      } catch {
        throw new InternalServerErrorException(
          `File "${compressedFullFileName}" could not be deleted from server`,
        )
      }
    }
    return
  }
}
