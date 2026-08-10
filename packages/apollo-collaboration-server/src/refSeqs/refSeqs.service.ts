import { RefSeq, type RefSeqDocument } from '@apollo-annotation/schemas'
import { Injectable, Logger, NotFoundException } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { type FilterQuery, Model } from 'mongoose'

import { CreateRefSeqDto } from './dto/create-refSeq.dto.js'
import { FindRefSeqDto } from './dto/find-refSeq.dto.js'
import { UpdateRefSeqDto } from './dto/update-refSeq.dto.js'

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

  /**
   * @param filter - Restrict to a single assembly
   * @param allowedAssemblyIds - If given and `filter` names no assembly,
   * restrict to these assemblies. Pass `undefined` for an unrestricted query.
   */
  findAll(filter?: FindRefSeqDto, allowedAssemblyIds?: string[]) {
    const query: FilterQuery<RefSeqDocument> = {}
    if (filter?.assembly) {
      query.assembly = filter.assembly
    } else if (allowedAssemblyIds) {
      query.assembly = { $in: allowedAssemblyIds }
    }
    // eslint-disable-next-line unicorn/no-array-callback-reference
    return this.refSeqModel.find(query).exec()
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
