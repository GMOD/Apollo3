import { CacheModule, Module } from '@nestjs/common'
import { MongooseModule, getConnectionToken } from '@nestjs/mongoose'
import { ChangeLog, ChangeLogSchema } from 'apollo-schemas'
import idValidator from 'mongoose-id-validator'

import { AssembliesModule } from '../assemblies/assemblies.module'
import { FeaturesModule } from '../features/features.module'
import { RefSeqsModule } from '../refSeqs/refSeqs.module'
import { ChangeController } from './change.controller'
import { ChangeService } from './change.service'

@Module({
  controllers: [ChangeController],
  providers: [ChangeService],
  imports: [
    MongooseModule.forFeatureAsync([
      {
        name: ChangeLog.name,
        useFactory: (connection) => {
          ChangeLogSchema.plugin(idValidator, { connection })
          return ChangeLogSchema
        },
        inject: [getConnectionToken()],
      },
    ]),
    AssembliesModule,
    RefSeqsModule,
    FeaturesModule,
    CacheModule.register({ ttl: 0, max: 1000000 }), // 0 = no cache expiration, 100 000 = number of entries
  ],
})
export class ChangeModule {}
