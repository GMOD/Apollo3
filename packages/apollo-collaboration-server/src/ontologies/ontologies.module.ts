import { Module } from '@nestjs/common'

import { FeaturesModule } from '../features/features.module'
import { OntologiesController } from './ontologies.controller'
import { OntologiesService } from './ontologies.service'

@Module({
  controllers: [OntologiesController],
  providers: [OntologiesService],
  imports: [FeaturesModule],
})
export class OntologiesModule {}
