import { Module, forwardRef } from '@nestjs/common'

import { FeaturesModule } from '../features/features.module'
import { OperationsModule } from '../operations/operations.module'
import { OntologiesController } from './ontologies.controller'
import { OntologiesService } from './ontologies.service'

@Module({
  controllers: [OntologiesController],
  providers: [OntologiesService],
  imports: [FeaturesModule, forwardRef(() => OperationsModule)],
  exports: [OntologiesService],
})
export class OntologiesModule {}
