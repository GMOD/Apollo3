import { Assembly, AssemblySchema } from '@apollo-annotation/schemas'
import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { FeaturesModule } from 'src/features/features.module'
import { RefSeqsModule } from 'src/refSeqs/refSeqs.module'

import { ChecksModule } from '../checks/checks.module'
import { OperationsModule } from '../operations/operations.module'

import { AssembliesController } from './assemblies.controller'
import { AssembliesService } from './assemblies.service'

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
