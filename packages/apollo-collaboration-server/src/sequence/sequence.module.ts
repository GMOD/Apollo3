import { Module } from '@nestjs/common'

import { AssembliesModule } from '../assemblies/assemblies.module'
import { RefSeqChunksModule } from '../refSeqChunks/refSeqChunks.module'
import { RefSeqsModule } from '../refSeqs/refSeqs.module'
import { SequenceController } from './sequence.controller'
import { SequenceService } from './sequence.service'

@Module({
  imports: [RefSeqsModule, RefSeqChunksModule, AssembliesModule],
  providers: [SequenceService],
  controllers: [SequenceController],
  exports: [SequenceService],
})
export class SequenceModule {}
