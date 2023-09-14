import { Module, forwardRef } from '@nestjs/common'
import { MongooseModule, getConnectionToken } from '@nestjs/mongoose'
import { CheckReport, CheckReportSchema } from 'apollo-schemas'
import idValidator from 'mongoose-id-validator'

import { FeaturesModule } from '../features/features.module'
import { CheckReportsController } from './checkReports.controller'
import { CheckReportsService } from './checkReports.service'

@Module({
  imports: [
    MongooseModule.forFeatureAsync([
      {
        name: CheckReport.name,
        useFactory: (connection) => {
          CheckReportSchema.plugin(idValidator, { connection })
          return CheckReportSchema
        },
        inject: [getConnectionToken()],
      },
    ]),
    forwardRef(() => FeaturesModule),
  ],
  exports: [MongooseModule],
  controllers: [CheckReportsController],
  providers: [CheckReportsService],
})
export class CheckReportsModule {}
