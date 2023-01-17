import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { Node, NodeSchema } from 'apollo-schemas'

import { OntologiesController } from './ontologies.controller'
import { OntologiesService } from './ontologies.service'

@Module({
  controllers: [OntologiesController],
  providers: [OntologiesService],
  imports: [
    MongooseModule.forFeature([{ name: Node.name, schema: NodeSchema }]),
  ],
  exports: [MongooseModule],
})
export class OntologiesModule {}
