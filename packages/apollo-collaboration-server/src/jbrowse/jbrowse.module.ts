/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  JBrowseAssembly,
  JBrowseAssemblySchema,
  JBrowseRefSeq,
  JBrowseRefSeqSchema,
  JBrowseConfig,
  JBrowseConfigSchema,
} from '@apollo-annotation/schemas'
import { Module, forwardRef } from '@nestjs/common'
import { MongooseModule, getConnectionToken } from '@nestjs/mongoose'
import idValidator from 'mongoose-id-validator'

import { AssembliesModule } from '../assemblies/assemblies.module.js'
import { ChecksModule } from '../checks/checks.module.js'
import { RefSeqsModule } from '../refSeqs/refSeqs.module.js'

import { JBrowseController } from './jbrowse.controller.js'
import { JBrowseService } from './jbrowse.service.js'

@Module({
  controllers: [JBrowseController],
  imports: [
    // AssembliesModule,
    forwardRef(() => AssembliesModule),
    ChecksModule,
    MongooseModule.forFeatureAsync([
      {
        name: JBrowseConfig.name,
        useFactory: (connection) => {
          JBrowseConfigSchema.plugin(idValidator, { connection })
          return JBrowseConfigSchema
        },
        inject: [getConnectionToken()],
      },
      {
        name: JBrowseAssembly.name,
        useFactory: (connection) => {
          JBrowseAssemblySchema.plugin(idValidator, { connection })
          return JBrowseAssemblySchema
        },
        inject: [getConnectionToken()],
      },
      {
        name: JBrowseRefSeq.name,
        useFactory: (connection) => {
          JBrowseRefSeqSchema.plugin(idValidator, { connection })
          return JBrowseRefSeqSchema
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
