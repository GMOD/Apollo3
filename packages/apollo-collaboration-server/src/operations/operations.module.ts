import { Module, forwardRef } from '@nestjs/common'

import { AssembliesModule } from '../assemblies/assemblies.module.js'
import { ChecksModule } from '../checks/checks.module.js'
import { CountersModule } from '../counters/counters.module.js'
import { FeaturesModule } from '../features/features.module.js'
import { FilesModule } from '../files/files.module.js'
import { JBrowseModule } from '../jbrowse/jbrowse.module.js'
import { MessagesModule } from '../messages/messages.module.js'
import { RefSeqChunksModule } from '../refSeqChunks/refSeqChunks.module.js'
import { RefSeqsModule } from '../refSeqs/refSeqs.module.js'
import { UsersModule } from '../users/users.module.js'

import { OperationsService } from './operations.service.js'

@Module({
  imports: [
    forwardRef(() => AssembliesModule),
    forwardRef(() => FeaturesModule),
    RefSeqsModule,
    RefSeqChunksModule,
    FilesModule,
    UsersModule,
    CountersModule,
    MessagesModule,
    JBrowseModule,
    ChecksModule,
  ],
  providers: [OperationsService],
  exports: [OperationsService],
})
export class OperationsModule {}
