import { Module, forwardRef } from '@nestjs/common'

import { AssembliesModule } from '../assemblies/assemblies.module'
import { CountersModule } from '../counters/counters.module'
import { FeaturesModule } from '../features/features.module'
import { FilesModule } from '../files/files.module'
import { MessagesModule } from '../messages/messages.module'
import { RefSeqChunksModule } from '../refSeqChunks/refSeqChunks.module'
import { RefSeqsModule } from '../refSeqs/refSeqs.module'
import { UsersModule } from '../users/users.module'
import { OperationsService } from './operations.service'

@Module({
  imports: [
    forwardRef(() => AssembliesModule),
    // forwardRef(() => FeaturesModule), //KS comment: We can comment this out if we do not import assemblies module into features module
    FeaturesModule,
    RefSeqsModule,
    RefSeqChunksModule,
    FilesModule,
    UsersModule,
    CountersModule,
    MessagesModule,
  ],
  providers: [OperationsService],
  exports: [OperationsService],
})
export class OperationsModule {}
