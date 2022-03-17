import { CacheModule, Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'

import { AssemblySchema } from '../model/assembly.model'
import { FeatureSchema } from '../model/feature.model'
import { RefSeqSchema } from '../model/refSeq.model'
import { FeaturesController } from './features.controller'
import { FeaturesService } from './features.service'

@Module({
  controllers: [FeaturesController],
  providers: [FeaturesService],
  imports: [
    CacheModule.register({ ttl: 0, max: 1000000 }), // 0 = no cache expiration, 100 000 = number of entries
    MongooseModule.forFeature([{ name: 'Assembly', schema: AssemblySchema }]),
    MongooseModule.forFeature([{ name: 'RegSeq', schema: RefSeqSchema }]),
    MongooseModule.forFeature([{ name: 'Feature', schema: FeatureSchema }]),
  ],
})
export class FeaturesModule {}
