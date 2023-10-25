import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { CheckReport, CheckReportSchema } from 'apollo-schemas'

import { SequenceModule } from '../sequence/sequence.module'
import { ChecksService } from './checks.service'

@Module({
  providers: [ChecksService],
  imports: [
    MongooseModule.forFeature([
      { name: CheckReport.name, schema: CheckReportSchema },
    ]),
  ],
  exports: [ChecksService],
})
export class ChecksModule {}
