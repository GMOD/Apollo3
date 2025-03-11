import { RefSeq, RefSeqDocument } from '@apollo-annotation/schemas'
import { Injectable, Logger, NotFoundException } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model } from 'mongoose'

import { CreateRefSeqDto } from './dto/create-refSeq.dto'
import { FindRefSeqDto } from './dto/find-refSeq.dto'
import { UpdateRefSeqDto } from './dto/update-refSeq.dto'

@Injectable()
export class RefSeqsService {
  constructor(
    @InjectModel(RefSeq.name)
    private readonly refSeqModel: Model<RefSeqDocument>,
  ) {}

  private readonly logger = new Logger(RefSeqsService.name)

  create(createRefSeqDto: CreateRefSeqDto) {
    return this.refSeqModel.create(createRefSeqDto)
  }

  findAll(filter?: FindRefSeqDto) {
    // eslint-disable-next-line unicorn/no-array-callback-reference
    return this.refSeqModel.find(filter ?? {}).exec()
  }

  async findOne(id: string) {
    const refSeq = await this.refSeqModel.findById(id).exec()
    if (!refSeq) {
      throw new NotFoundException(`RefSeq with id "${id}" not found`)
    }
    return refSeq
  }

  update(id: string, updateRefSeqDto: UpdateRefSeqDto) {
    return this.refSeqModel
      .findByIdAndUpdate(id, updateRefSeqDto, { runValidators: true })
      .exec()
  }

  remove(id: string) {
    return this.refSeqModel.findByIdAndDelete(id).exec()
  }
}
