/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { JBrowseConfig, JBrowseConfigSchema } from '@apollo-annotation/schemas'
import { Module, forwardRef } from '@nestjs/common'
import { MongooseModule, getConnectionToken } from '@nestjs/mongoose'
import idValidator from 'mongoose-id-validator'

import { AssembliesModule } from '../assemblies/assemblies.module.js'
import { ChecksModule } from '../checks/checks.module.js'
import { RefSeqsModule } from '../refSeqs/refSeqs.module.js'

import { JBrowseConfigModule } from './jbrowseConfig.module.js'
import { JBrowseController } from './jbrowse.controller.js'
import { JBrowseService } from './jbrowse.service.js'

@Module({
  controllers: [JBrowseController],
  imports: [
    forwardRef(() => AssembliesModule),
    ChecksModule,
    JBrowseConfigModule,
    MongooseModule.forFeatureAsync([
      {
        name: JBrowseConfig.name,
        useFactory: (connection) => {
          JBrowseConfigSchema.plugin(idValidator, { connection })
          return JBrowseConfigSchema
        },
        inject: [getConnectionToken()],
      },
    ]),
    RefSeqsModule,
  ],
  providers: [JBrowseService],
  exports: [MongooseModule, JBrowseService],
})
export class JBrowseModule {}
