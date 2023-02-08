import { Module, forwardRef } from '@nestjs/common'
import { Assembly, AssemblySchema } from 'apollo-schemas'
import { MongooseModule } from '@nestjs/mongoose'
import { CountersModule } from 'src/counters/counters.module'
import { FeaturesModule } from 'src/features/features.module'
import { FilesModule } from 'src/files/files.module'
import { OperationsService } from 'src/operations/operations.service'
import { RefSeqChunksModule } from 'src/refSeqChunks/refSeqChunks.module'
import { RefSeqsModule } from 'src/refSeqs/refSeqs.module'
import { UsersModule } from 'src/users/users.module'
// import { OperationsService } from '../operations/operations.service'
import { OntologiesController } from './ontologies.controller'
import { OntologiesService } from './ontologies.service'
import { AssembliesModule } from '../assemblies/assemblies.module'
import { OperationsModule } from '../operations/operations.module'

@Module({
  controllers: [OntologiesController],
  providers: [OntologiesService, OperationsService],
  imports: [
    MongooseModule.forFeature([
      { name: Assembly.name, schema: AssemblySchema },
    ]),
    forwardRef(() => FeaturesModule),
    forwardRef(() => FilesModule),
    forwardRef(() => AssembliesModule),
    // AssembliesModule,
    RefSeqsModule,
    RefSeqChunksModule,
    FeaturesModule,
    FilesModule,
    UsersModule,
    CountersModule,
    forwardRef(() => OperationsModule),
  ],
  exports: [OntologiesService],
})
export class OntologiesModule {}
