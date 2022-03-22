import { Injectable, NotFoundException } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model } from 'mongoose'

import { CreateRefSeqDto } from './dto/create-refSeq.dto'
import { RefSeq, RefSeqDocument } from './schemas/refSeq.schema'

@Injectable()
export class RefSeqsService {
  constructor(
    @InjectModel(RefSeq.name)
    private readonly RefSeqModel: Model<RefSeqDocument>,
  ) {}

  async create(createRefSeqDto: CreateRefSeqDto): Promise<RefSeq> {
    const createdRefSeq = new this.RefSeqModel(createRefSeqDto)
    return createdRefSeq.save()
  }

  async findAll(): Promise<RefSeq[]> {
    return this.RefSeqModel.find().exec()
  }

  async find(id: string): Promise<RefSeq> {
    const refSeq = await this.RefSeqModel.findOne({ _id: id }).exec()
    if (!refSeq) {
      throw new NotFoundException(`RefSeq with id "${id}" not found`)
    }
    return refSeq
  }
}
