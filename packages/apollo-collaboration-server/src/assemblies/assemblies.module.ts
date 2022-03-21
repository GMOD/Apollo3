import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'

import { Assembly, AssemblySchema } from '../schemas/assembly.schema'
import { Feature, FeatureSchema } from '../schemas/feature.schema'
import { RefSeq, RefSeqSchema } from '../schemas/refseq.schema'
import { AssembliesController } from './assemblies.controller'
import { AssembliesService } from './assemblies.service'

@Module({
  controllers: [AssembliesController],
  providers: [AssembliesService],
  imports: [
    MongooseModule.forFeature([
      { name: Assembly.name, schema: AssemblySchema },
    ]),
    MongooseModule.forFeature([{ name: RefSeq.name, schema: RefSeqSchema }]),
    MongooseModule.forFeature([{ name: Feature.name, schema: FeatureSchema }]),
  ],
})
export class AssembliesModule {}
