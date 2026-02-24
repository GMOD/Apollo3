import { Module, forwardRef } from '@nestjs/common'

import { AssembliesModule } from '../assemblies/assemblies.module.js'
import { FilesModule } from '../files/files.module.js'
import { RefSeqChunksModule } from '../refSeqChunks/refSeqChunks.module.js'
import { RefSeqsModule } from '../refSeqs/refSeqs.module.js'

import { SequenceController } from './sequence.controller.js'
import { SequenceService } from './sequence.service.js'

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
