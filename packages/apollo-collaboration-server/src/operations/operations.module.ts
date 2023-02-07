import { Module } from '@nestjs/common'

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
    AssembliesModule,
    RefSeqsModule,
    RefSeqChunksModule,
    FeaturesModule,
    FilesModule,
    UsersModule,
    CountersModule,
    MessagesModule,
  ],
  providers: [OperationsService],
})
export class OperationsModule {}
