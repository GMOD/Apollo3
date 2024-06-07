/* eslint-disable @typescript-eslint/no-unnecessary-condition */
import { Counter, CounterDocument } from '@apollo-annotation/apollo-schemas'
import { Injectable, Logger, NotFoundException } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model } from 'mongoose'

@Injectable()
export class CountersService {
  constructor(
    @InjectModel(Counter.name)
    private readonly counterModel: Model<CounterDocument>,
  ) {}

  private readonly logger = new Logger(CountersService.name)

  async getNextSequenceValue(sequenceName: string): Promise<number> {
    const sequenceDocument = await this.counterModel
      .findOneAndUpdate(
        { id: sequenceName },
        { $inc: { sequenceValue: 1 } },
        { new: true, upsert: true },
      )
      .exec()
    if (!sequenceDocument) {
      const errMsg = 'ERROR when getting next sequence value'
      this.logger.error(errMsg)
      throw new NotFoundException(errMsg)
    }
    return sequenceDocument.sequenceValue
  }
}
