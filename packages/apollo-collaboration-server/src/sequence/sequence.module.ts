import { Module, forwardRef } from '@nestjs/common'

import { AssembliesModule } from '../assemblies/assemblies.module'
import { FilesModule } from '../files/files.module'
import { RefSeqChunksModule } from '../refSeqChunks/refSeqChunks.module'
import { RefSeqsModule } from '../refSeqs/refSeqs.module'

import { SequenceController } from './sequence.controller'
import { SequenceService } from './sequence.service'

@Module({
  imports: [
    forwardRef(() => AssembliesModule),
    FilesModule,
    RefSeqsModule,
    RefSeqChunksModule,
  ],
  providers: [SequenceService],
  controllers: [SequenceController],
  exports: [SequenceService],
})
export class SequenceModule {}
