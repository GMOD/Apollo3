import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'

import { RefSeqsController } from './refSeqs.controller'
import { RefSeqsService } from './refSeqs.service'
import { RefSeq, RefSeqSchema } from './schemas/refSeq.schema'

@Module({
  imports: [
    MongooseModule.forFeature([{ name: RefSeq.name, schema: RefSeqSchema }]),
  ],
  controllers: [RefSeqsController],
  providers: [RefSeqsService],
})
export class RefSeqsModule {}
