import { Module } from '@nestjs/common'

import { RefseqsController } from './refseqs.controller'
import { RefseqsService } from './refseqs.service'

@Module({
  controllers: [RefseqsController],
  providers: [RefseqsService],
})
export class RefseqsModule {}
