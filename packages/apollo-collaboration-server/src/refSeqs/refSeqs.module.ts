import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { RefSeq, RefSeqSchema } from 'apollo-schemas'

import { RefSeqsController } from './refSeqs.controller'
import { RefSeqsService } from './refSeqs.service'

@Module({
  imports: [
    MongooseModule.forFeature([{ name: RefSeq.name, schema: RefSeqSchema }]),
  ],
  controllers: [RefSeqsController],
  providers: [RefSeqsService],
})
export class RefSeqsModule {}
