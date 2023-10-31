import { Module, forwardRef } from '@nestjs/common'
import { MongooseModule, getConnectionToken } from '@nestjs/mongoose'
import { CheckReport, CheckReportSchema } from 'apollo-schemas'
import idValidator from 'mongoose-id-validator'

import { OperationsModule } from '../operations/operations.module'
import { ChecksController } from './checks.controller'
import { ChecksService } from './checks.service'

@Module({
  providers: [ChecksService],
  imports: [
    forwardRef(() => OperationsModule),
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
  ],

  exports: [ChecksService],
  controllers: [ChecksController],
})
export class ChecksModule {}
