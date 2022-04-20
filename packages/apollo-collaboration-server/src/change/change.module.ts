import { CacheModule, Module } from '@nestjs/common'

import { AssembliesModule } from '../assemblies/assemblies.module'
import { FeaturesModule } from '../features/features.module'
import { RefSeqsModule } from '../refSeqs/refSeqs.module'
import { ChangeController } from './change.controller'
import { ChangeService } from './change.service'

@Module({
  controllers: [ChangeController],
  providers: [ChangeService],
  imports: [
    AssembliesModule,
    RefSeqsModule,
    FeaturesModule,
    CacheModule.register({ ttl: 0, max: 1000000 }), // 0 = no cache expiration, 100 000 = number of entries
  ],
})
export class ChangeModule {}
