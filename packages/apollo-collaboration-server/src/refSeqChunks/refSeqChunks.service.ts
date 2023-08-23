import { Injectable, Logger } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import {
  RefSeq,
  RefSeqChunk,
  RefSeqChunkDocument,
  RefSeqDocument,
} from 'apollo-schemas'
import { Model } from 'mongoose'

import { CreateRefSeqChunkDto } from './dto/create-refSeqChunk.dto'
import { GetSequenceDto } from './dto/get-sequence.dto'

@Injectable()
export class RefSeqChunksService {
  constructor(
    @InjectModel(RefSeqChunk.name)
    private readonly refSeqChunkModel: Model<RefSeqChunkDocument>,
    @InjectModel(RefSeq.name)
    private readonly refSeqModel: Model<RefSeqDocument>,
  ) {}

  private readonly logger = new Logger(RefSeqChunksService.name)

  create(createRefSeqChunkDto: CreateRefSeqChunkDto) {
    return this.refSeqChunkModel.create(createRefSeqChunkDto)
  }

  async getSequence({ end, refSeq: refSeqId, start }: GetSequenceDto) {
    const refSeq = await this.refSeqModel.findById(refSeqId)
    if (!refSeq) {
      throw new Error(`RefSeq "${refSeqId}" not found`)
    }
    const { chunkSize } = refSeq
    const startChunk = Math.floor(start / chunkSize)
    const endChunk = Math.floor(end / chunkSize)
    const seq: string[] = []
    for await (const refSeqChunk of this.refSeqChunkModel
      .find({
        refSeq,
        $and: [{ n: { $gte: startChunk } }, { n: { $lte: endChunk } }],
      })
      .sort({ n: 1 })) {
      const { n, sequence } = refSeqChunk
      if (n === startChunk || n === endChunk) {
        seq.push(
          sequence.slice(
            n === startChunk ? start - n * chunkSize : undefined,
            n === endChunk ? end - n * chunkSize : undefined,
          ),
        )
      } else {
        seq.push(sequence)
      }
    }
    return seq.join('')
  }
}
