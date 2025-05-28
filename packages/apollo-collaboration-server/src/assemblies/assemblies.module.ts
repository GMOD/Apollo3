import { Assembly, AssemblySchema } from '@apollo-annotation/schemas'
import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'

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
  exports: [MongooseModule, AssembliesService],
})
export class AssembliesModule {}
