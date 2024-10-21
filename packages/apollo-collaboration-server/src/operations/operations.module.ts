import { Module, forwardRef } from '@nestjs/common'

import { AssembliesModule } from '../assemblies/assemblies.module'
import { ChecksModule } from '../checks/checks.module'
import { CountersModule } from '../counters/counters.module'
import { FeaturesModule } from '../features/features.module'
import { FilesModule } from '../files/files.module'
import { JBrowseModule } from '../jbrowse/jbrowse.module'
import { MessagesModule } from '../messages/messages.module'
import { RefSeqChunksModule } from '../refSeqChunks/refSeqChunks.module'
import { RefSeqsModule } from '../refSeqs/refSeqs.module'
import { UsersModule } from '../users/users.module'
import { OperationsService } from './operations.service'

@Module({
  imports: [
    forwardRef(() => AssembliesModule),
    FeaturesModule,
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
