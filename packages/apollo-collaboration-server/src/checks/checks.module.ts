import { Module } from '@nestjs/common'

import { ChecksService } from './checks.service'

@Module({
  providers: [ChecksService],
  exports: [ChecksService],
})
export class ChecksModule {}
