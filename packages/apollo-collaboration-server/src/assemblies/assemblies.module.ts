import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'

import { Feature, FeatureSchema } from '../features/schemas/feature.schema'
import { RefSeq, RefSeqSchema } from '../refseqs/schemas/refSeq.schema'
import { AssembliesController } from './assemblies.controller'
import { AssembliesService } from './assemblies.service'
import { Assembly, AssemblySchema } from './schemas/assembly.schema'

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
