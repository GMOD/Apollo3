import { Module, forwardRef } from '@nestjs/common'

import { AssembliesModule } from '../assemblies/assemblies.module.js'
import { JBrowseConfigModule } from '../jbrowse/jbrowseConfig.module.js'
import { RefSeqsModule } from '../refSeqs/refSeqs.module.js'

import { SequenceController } from './sequence.controller.js'
import { SequenceService } from './sequence.service.js'

@Module({
  imports: [
    forwardRef(() => AssembliesModule),
    JBrowseConfigModule,
    RefSeqsModule,
  ],
  providers: [SequenceService],
  controllers: [SequenceController],
  exports: [SequenceService],
})
export class SequenceModule {}
