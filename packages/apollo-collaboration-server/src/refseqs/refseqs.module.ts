import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'

import { Assembly, AssemblySchema } from '../assemblies/schemas/assembly.schema'
import { Feature, FeatureSchema } from '../features/schemas/feature.schema'
import { RefseqsController } from './refseqs.controller'
import { RefseqsService } from './refseqs.service'
import { RefSeq, RefSeqSchema } from './schemas/refSeq.schema'

@Module({
  controllers: [RefseqsController],
  providers: [RefseqsService],
  imports: [
    MongooseModule.forFeature([
      { name: Assembly.name, schema: AssemblySchema },
    ]),
    MongooseModule.forFeature([{ name: RefSeq.name, schema: RefSeqSchema }]),
    MongooseModule.forFeature([{ name: Feature.name, schema: FeatureSchema }]),
  ],
})
export class RefseqsModule {}
