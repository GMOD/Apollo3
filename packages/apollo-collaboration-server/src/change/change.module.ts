import { Module } from '@nestjs/common'

import { FeaturesModule } from '../features/features.module'
import { ChangeController } from './change.controller'
import { ChangeService } from './change.service'

@Module({
  controllers: [ChangeController],
  providers: [ChangeService],
  imports: [FeaturesModule],
})
export class ChangeModule {}
