import { Module } from '@nestjs/common'
import { MongooseModule, getConnectionToken } from '@nestjs/mongoose'
import {
  CheckReport,
  CheckReportSchema,
  Feature,
  FeatureSchema,
} from 'apollo-schemas'
import { Connection } from 'mongoose'
import idValidator from 'mongoose-id-validator'

import { ChecksService } from './checks.service'

@Module({
  providers: [ChecksService],
  imports: [
    MongooseModule.forFeature([
      { name: CheckReport.name, schema: CheckReportSchema },
    ]),
    MongooseModule.forFeatureAsync([
      {
        name: Feature.name,
        useFactory: (connection: Connection, checksService: ChecksService) => {
          FeatureSchema.plugin(idValidator, { connection })
          FeatureSchema.post('save', async (doc) => {
            await checksService.checkFeature(doc)
          })
          return FeatureSchema
        },
        imports: [ChecksModule],
        inject: [getConnectionToken(), ChecksService],
      },
    ]),
  ],
  exports: [ChecksService],
})
export class ChecksModule {}
