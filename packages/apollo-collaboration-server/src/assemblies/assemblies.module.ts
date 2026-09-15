import { Assembly, AssemblySchema } from '@apollo-annotation/schemas'
import { Module } from '@nestjs/common'
import { MongooseModule, getConnectionToken } from '@nestjs/mongoose'
import idValidator from 'mongoose-id-validator'

import { ChecksModule } from '../checks/checks.module.js'
import { FeaturesModule } from '../features/features.module.js'
import { RefSeqsModule } from '../refSeqs/refSeqs.module.js'

import { AssembliesController } from './assemblies.controller.js'
import { AssembliesService } from './assemblies.service.js'

@Module({
  controllers: [AssembliesController],
  providers: [AssembliesService],
  imports: [
    MongooseModule.forFeatureAsync([
      {
        name: Assembly.name,
        useFactory: (connection) => {
          AssemblySchema.plugin(idValidator, { connection })
          return AssemblySchema
        },
        inject: [getConnectionToken()],
      },
    ]),
    ChecksModule,
    FeaturesModule,
    RefSeqsModule,
  ],
  exports: [MongooseModule, AssembliesService],
})
export class AssembliesModule {}
