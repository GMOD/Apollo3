import { Module, forwardRef } from '@nestjs/common'

import { AssembliesModule } from '../assemblies/assemblies.module'
import { CountersModule } from '../counters/counters.module'
import { FeaturesModule } from '../features/features.module'
import { FilesModule } from '../files/files.module'
import { MessagesModule } from '../messages/messages.module'
import { OntologiesModule } from '../ontologies/ontologies.module'
import { RefSeqChunksModule } from '../refSeqChunks/refSeqChunks.module'
import { RefSeqsModule } from '../refSeqs/refSeqs.module'
import { UsersModule } from '../users/users.module'
import { OperationsService } from './operations.service'

@Module({
  imports: [
    forwardRef(() => AssembliesModule),
    forwardRef(() => OntologiesModule),
    RefSeqsModule,
    RefSeqChunksModule,
    FeaturesModule,
    FilesModule,
    UsersModule,
    CountersModule,
    MessagesModule,
  ],
  providers: [OperationsService],
  exports: [OperationsService],
})
export class OperationsModule {}
