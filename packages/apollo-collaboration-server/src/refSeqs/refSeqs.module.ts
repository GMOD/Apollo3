import { Module } from '@nestjs/common';
import { RefseqsController } from './refSeqs.controller';
import { RefseqsService } from './refSeqs.service';

@Module({
  controllers: [RefseqsController],
  providers: [RefseqsService]
})
export class RefseqsModule {}
