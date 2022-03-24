import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import {
  Assembly,
  AssemblySchema,
  Feature,
  FeatureSchema,
  RefSeq,
  RefSeqSchema,
} from 'apollo-shared'
import { FeaturesModule } from '../features/features.module'

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
