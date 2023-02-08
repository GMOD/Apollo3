import { Module } from '@nestjs/common'
// import { OperationsService } from '../operations/operations.service'
import { OperationsService } from 'src/operations/operations.service'

import { OntologiesController } from './ontologies.controller'
import { OntologiesService } from './ontologies.service'

@Module({
  controllers: [OntologiesController],
  providers: [OntologiesService, OperationsService],
  exports: [OntologiesService],
})
export class OntologiesModule {}
