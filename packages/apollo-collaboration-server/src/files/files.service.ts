import { Injectable, Logger } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { UserFile, UserFileDocument } from 'apollo-schemas'
import { Model } from 'mongoose'

import { CreateFileDto } from './dto/create-file.dto'

@Injectable()
export class FilesService {
  constructor(
    @InjectModel(UserFile.name)
    private readonly UserFileModel: Model<UserFileDocument>,
  ) {}

  private readonly logger = new Logger(FilesService.name)

  create(createFileDto: CreateFileDto) {
    this.logger.debug(
      `Add uploaded file info into Mongo: ${JSON.stringify(createFileDto)}`,
    )
    return this.UserFileModel.create(createFileDto)
  }
}
