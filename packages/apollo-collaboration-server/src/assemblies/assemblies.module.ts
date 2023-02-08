import { Module, forwardRef } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { Assembly, AssemblySchema } from 'apollo-schemas'
import { CountersModule } from 'src/counters/counters.module'
import { FeaturesModule } from 'src/features/features.module'
import { FilesModule } from 'src/files/files.module'
import { OperationsService } from 'src/operations/operations.service'
import { RefSeqChunksModule } from 'src/refSeqChunks/refSeqChunks.module'
import { RefSeqsModule } from 'src/refSeqs/refSeqs.module'
import { UsersModule } from 'src/users/users.module'
import { OntologiesModule } from '../ontologies/ontologies.module'

import { AssembliesController } from './assemblies.controller'
import { AssembliesService } from './assemblies.service'

@Module({
  controllers: [AssembliesController],
  providers: [AssembliesService, OperationsService],
  imports: [
    MongooseModule.forFeature([
      { name: Assembly.name, schema: AssemblySchema },
    ]),
    forwardRef(() => FeaturesModule),
    forwardRef(() => FilesModule),
    RefSeqsModule,
    RefSeqChunksModule,
    UsersModule,
    CountersModule,
    forwardRef(() => OntologiesModule),
  ],
  exports: [MongooseModule],
})
export class AssembliesModule {}
