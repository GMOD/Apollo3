import { CacheModule, Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'

import { Assembly, AssemblySchema } from '../schemas/assembly.schema'
import { Feature, FeatureSchema } from '../schemas/feature.schema'
import { RefSeq, RefSeqSchema } from '../schemas/refseq.schema'
import { FeaturesController } from './features.controller'
import { FeaturesService } from './features.service'

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
