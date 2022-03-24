import { CacheModule, Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import {
  Assembly,
  AssemblySchema,
  Feature,
  FeatureSchema,
  RefSeq,
  RefSeqSchema,
} from 'apollo-shared'

// import { Assembly, AssemblySchema } from '../assemblies/schemas/assembly.schema'
// import { RefSeq, RefSeqSchema } from '../refseqs/schemas/refSeq.schema'
import { FeaturesController } from './features.controller'
import { FeaturesService } from './features.service'
// import { Feature, FeatureSchema } from './schemas/feature.schema'

@Module({
  controllers: [FeaturesController],
  providers: [FeaturesService],
  imports: [
    CacheModule.register({ ttl: 0, max: 1000000 }), // 0 = no cache expiration, 100 000 = number of entries
    MongooseModule.forFeature([
      { name: Assembly.name, schema: AssemblySchema },
    ]),
    MongooseModule.forFeature([{ name: RefSeq.name, schema: RefSeqSchema }]),
    MongooseModule.forFeature([{ name: Feature.name, schema: FeatureSchema }]),
  ],
})
export class FeaturesModule {}
