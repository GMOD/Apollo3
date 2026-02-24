import { Assembly, AssemblySchema } from '@apollo-annotation/schemas'
import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'

import { ChecksModule } from '../checks/checks.module.js'
import { FeaturesModule } from '../features/features.module.js'
import { OperationsModule } from '../operations/operations.module.js'
import { RefSeqsModule } from '../refSeqs/refSeqs.module.js'

import { AssembliesController } from './assemblies.controller.js'
import { AssembliesService } from './assemblies.service.js'

@Module({
  controllers: [AssembliesController],
  providers: [AssembliesService],
  imports: [
    MongooseModule.forFeature([
      { name: Assembly.name, schema: AssemblySchema },
    ]),
    ChecksModule,
    FeaturesModule,
    OperationsModule,
    RefSeqsModule,
  ],
  exports: [MongooseModule, AssembliesService],
})
export class AssembliesModule {}
