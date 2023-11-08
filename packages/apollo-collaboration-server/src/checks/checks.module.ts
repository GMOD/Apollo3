import { Module, forwardRef } from '@nestjs/common'
import { MongooseModule, getConnectionToken } from '@nestjs/mongoose'
import { CheckResult, CheckResultSchema } from 'apollo-schemas'
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
        name: CheckResult.name,
        useFactory: (connection) => {
          CheckResultSchema.plugin(idValidator, { connection })
          return CheckResultSchema
        },
        inject: [getConnectionToken()],
      },
    ]),
  ],

  exports: [ChecksService],
  controllers: [ChecksController],
})
export class ChecksModule {}
