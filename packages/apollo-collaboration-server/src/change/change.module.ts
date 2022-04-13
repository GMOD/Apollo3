import { Module } from '@nestjs/common'

import { AssembliesModule } from '../assemblies/assemblies.module'
import { FeaturesModule } from '../features/features.module'
import { RefSeqsModule } from '../refSeqs/refSeqs.module'
import { ChangeController } from './change.controller'
import { ChangeService } from './change.service'

@Module({
  controllers: [ChangeController],
  providers: [ChangeService],
  imports: [AssembliesModule, RefSeqsModule, FeaturesModule],
})
export class ChangeModule {}
