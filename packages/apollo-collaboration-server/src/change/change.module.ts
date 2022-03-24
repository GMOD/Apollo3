import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { Assembly, AssemblySchema, Feature, FeatureSchema, RefSeq, RefSeqSchema } from 'apollo-shared'

import { ChangeController } from './change.controller'
import { ChangeService } from './change.service'

@Module({
  controllers: [ChangeController],
  providers: [ChangeService],
  imports: [
    MongooseModule.forFeature([
      { name: Assembly.name, schema: AssemblySchema },
    ]),
    MongooseModule.forFeature([{ name: RefSeq.name, schema: RefSeqSchema }]),
    MongooseModule.forFeature([{ name: Feature.name, schema: FeatureSchema }]),
  ],
})
export class ChangeModule {}
