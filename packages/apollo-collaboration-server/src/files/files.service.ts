import fs from 'fs'

import { Injectable, Logger, NotFoundException } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import {
  Assembly,
  AssemblyDocument,
  Feature,
  FeatureDocument,
  File,
  FileDocument,
  RefSeq,
  RefSeqChunk,
  RefSeqChunkDocument,
  RefSeqDocument,
} from 'apollo-schemas'
import {
  AddAssemblyFromFileChange,
  SerializedAddAssemblyFromFileChangeSingle,
  changeRegistry,
} from 'apollo-shared' // *** FOR TEST ONLY
import { Model } from 'mongoose'

import { CreateFileDto } from './dto/create-file.dto'

@Injectable()
export class FilesService {
  constructor(
    @InjectModel(File.name)
    private readonly fileModel: Model<FileDocument>,
    @InjectModel(Feature.name)
    private readonly featureModel: Model<FeatureDocument>,
    @InjectModel(Assembly.name)
    private readonly assemblyModel: Model<AssemblyDocument>,
    @InjectModel(RefSeq.name)
    private readonly refSeqModel: Model<RefSeqDocument>,
    @InjectModel(RefSeqChunk.name)
    private readonly refSeqChunkModel: Model<RefSeqChunkDocument>,
  ) {
    // changeRegistry.registerChange(
    //   'AddAssemblyFromFileChange',
    //   AddAssemblyFromFileChange,
    // )
  }

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

  // **** JUST FOR TEST *** //
  // **** WHEN YOU CALL THIS YOU HAVE TO PASS 'type' with value 'text/x-gff3' or 'text/x-fasta'
  async dummy() {
    // const serializedChange: SerializedChange = {
    //   changedIds: ['1', '2'],
    //   typeName: 'AddAssemblyFromFileChange',
    //   assemblyId: '624a7e97d45d7745c2532b01',
    //   changes: [
    //     {
    //       fileChecksum: '83d5568fdd38026c75a3aed528e9e81d',
    //       assemblyName: 'first demo assembly',
    //     },
    //   ],
    // }
    const serializedChange: SerializedAddAssemblyFromFileChangeSingle = {
      changedIds: ['1', '2'],
      typeName: 'AddAssemblyFromFileChange',
      assemblyId: '624a7e97d45d7745c2532b01',
      // fileChecksum: 'fb2999de4a94c1b14a686e7aacd18f89', // THIS IS SMALL FASTA FILE checksum
      // fileChecksum: '196d4f3a253b7c65aca19427edc346da', // THIS IS FASTA FILE checksum
      // fileChecksum: '83d5568fdd38026c75a3aed528e9e81d', // THIS IS GFF3 FILE checksum
      // fileChecksum: '20456a37df25aa01186610c816349383', // THIS IS GFF3 FILE that ends with 'GGGGG\n'
      fileChecksum: 'a318536dbb70da44e2bba18c6e7f6349', // THIS IS GFF3 FILE that ends with 'GGGGG' and without line break
      assemblyName: 'First demo assembly',
    }
    const ChangeType = changeRegistry.getChangeType(serializedChange.typeName)
    const change = new ChangeType(serializedChange, { logger: this.logger })
    this.logger.debug(`Requested change: ${JSON.stringify(change)}`)

    await this.featureModel.db.transaction(async (session) => {
      await change.apply({
        typeName: 'Server',
        featureModel: this.featureModel,
        assemblyModel: this.assemblyModel,
        refSeqModel: this.refSeqModel,
        refSeqChunkModel: this.refSeqChunkModel,
        fileModel: this.fileModel,
        session,
        fs,
      })
    })
  }
}
