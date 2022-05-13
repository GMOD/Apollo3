import { Injectable, Logger, NotFoundException } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { File, FileDocument } from 'apollo-schemas'
import { Model } from 'mongoose'

import { CreateFileDto } from './dto/create-file.dto'

@Injectable()
export class FilesService {
  constructor(
    @InjectModel(File.name)
    private readonly fileModel: Model<FileDocument>,
  ) {}

  private readonly logger = new Logger(FilesService.name)

  create(createFileDto: CreateFileDto) {
    this.logger.debug(
      `Add uploaded file info into Mongo: ${JSON.stringify(createFileDto)}`,
    )
    return this.fileModel.create(createFileDto)
  }

  async findOne(id: string) {
    const assembly = await this.fileModel.findById(id).exec()
    if (!assembly) {
      throw new NotFoundException(`Assembly with id "${id}" not found`)
    }
    return assembly
  }

  // **** JUST FOR TEST *** //
  // async create2(createFileDto: CreateFileDto) {
  //   // Add information into MongoDb
  //   const serializedChange: SerializedChange = {
  //     changedIds: ['1', '2'],
  //     typeName: 'AddFeaturesFromFileChange',
  //     assemblyId: '624a7e97d45d7745c2532b01',
  //     changes: [{ fileChecksum: '83d5568fdd38026c75a3aed528e9e81d' }],
  //   }
  //   const ChangeType = changeRegistry.getChangeType(serializedChange.typeName)
  //   const change = new ChangeType(serializedChange, { logger: this.logger })
  //   this.logger.debug(`Requested change: ${JSON.stringify(change)}`)

  //   // await this.featureModel.db.transaction(async (session) => {
  //   //   await change.apply({
  //   //     typeName: 'Server',
  //   //     featureModel: this.featureModel,
  //   //     assemblyModel: this.assemblyModel,
  //   //     refSeqModel: this.refSeqModel,
  //   //     // refSeqChunkModel: this.refSeqChunkModel,
  //   //     session,
  //   //   })
  //   // })

  //   return this.fileModel.create(createFileDto)
  // }
}
