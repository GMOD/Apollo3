/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Change, ChangeSchema } from '@apollo-annotation/schemas'
import { Module } from '@nestjs/common'
import { MongooseModule, getConnectionToken } from '@nestjs/mongoose'
import idValidator from 'mongoose-id-validator'

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
    AssembliesModule,
    RefSeqsModule,
    RefSeqChunksModule,
    FeaturesModule,
    FilesModule,
    UsersModule,
    CountersModule,
    ChecksModule,
    MessagesModule,
    JBrowseModule,
  ],
})
export class ChangesModule {}
