/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Change, ChangeSchema } from '@apollo-annotation/schemas'
import { Module } from '@nestjs/common'
import { MongooseModule, getConnectionToken } from '@nestjs/mongoose'
import idValidator from 'mongoose-id-validator'

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

import { ChangesController } from './changes.controller.js'
import { ChangesService } from './changes.service.js'

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
