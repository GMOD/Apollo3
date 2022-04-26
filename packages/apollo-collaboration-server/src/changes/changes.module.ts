import { CacheModule, Module } from '@nestjs/common'
import { MongooseModule, getConnectionToken } from '@nestjs/mongoose'
import { Change, ChangeSchema } from 'apollo-schemas'
import idValidator from 'mongoose-id-validator'

import { AssembliesModule } from '../assemblies/assemblies.module'
import { FeaturesModule } from '../features/features.module'
import { RefSeqsModule } from '../refSeqs/refSeqs.module'
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
    FeaturesModule,
    CacheModule.register({ ttl: 0, max: 1000000 }), // 0 = no cache expiration, 100 000 = number of entries
  ],
})
export class ChangesModule {}
