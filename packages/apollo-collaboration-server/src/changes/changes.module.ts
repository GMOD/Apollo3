import { Module, forwardRef } from '@nestjs/common'
import { MongooseModule, getConnectionToken } from '@nestjs/mongoose'
import { Change, ChangeSchema } from 'apollo-schemas'
import idValidator from 'mongoose-id-validator'

import { AssembliesModule } from '../assemblies/assemblies.module'
import { CountersModule } from '../counters/counters.module'
import { FeaturesModule } from '../features/features.module'
import { FilesModule } from '../files/files.module'
import { MessagesModule } from '../messages/messages.module'
import { RefSeqChunksModule } from '../refSeqChunks/refSeqChunks.module'
import { RefSeqsModule } from '../refSeqs/refSeqs.module'
import { UsersModule } from '../users/users.module'
import { ChangesController } from './changes.controller'
import { ChangesService } from './changes.service'

@Module({
  controllers: [ChangesController],
  providers: [ChangesService],
  imports: [
    MongooseModule.forFeatureAsync([
      {
        name: Change.name,
        useFactory: (connection) => {
          ChangeSchema.plugin(idValidator, { connection })
          return ChangeSchema
        },
        inject: [getConnectionToken()],
      },
    ]),
    // AssembliesModule, // Original
    forwardRef(() => AssembliesModule),
    RefSeqsModule,
    RefSeqChunksModule,
    FeaturesModule,
    FilesModule,
    UsersModule,
    CountersModule,
    MessagesModule,
  ],
})
export class ChangesModule {}
