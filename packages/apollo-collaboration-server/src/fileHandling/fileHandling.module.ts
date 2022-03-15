import { CacheModule, Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'

import { AssemblySchema } from '../model/assembly.model'
import { FeatureSchema } from '../model/feature.model'
import { RefSeqSchema } from '../model/refSeq.model'
import { FileHandlingController } from './fileHandling.controller'
import { FileHandlingService } from './fileHandling.service'

// const nodeEnv = process.env.NODE_ENV || 'production'

@Module({
  controllers: [FileHandlingController],
  providers: [FileHandlingService],
  imports: [
    CacheModule.register({ ttl: 0, max: 1000000 }), // 0 = no cache expiration, 100 000 = number of entries
    MongooseModule.forFeature([{ name: 'Assembly', schema: AssemblySchema }]),
    MongooseModule.forFeature([{ name: 'RegSeq', schema: RefSeqSchema }]),
    MongooseModule.forFeature([{ name: 'Feature', schema: FeatureSchema }]),
  ],
})
export class FileHandlingModule {}
