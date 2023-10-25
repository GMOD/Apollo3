import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { Assembly, AssemblySchema } from 'apollo-schemas'

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
    OperationsModule,
  ],
  // exports: [AssembliesService],
  exports: [MongooseModule, AssembliesService], // Original
})
export class AssembliesModule {}
