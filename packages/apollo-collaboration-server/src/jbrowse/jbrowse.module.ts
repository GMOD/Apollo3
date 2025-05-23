/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { JBrowseConfig, JBrowseConfigSchema } from '@apollo-annotation/schemas'
import { Module, forwardRef } from '@nestjs/common'
import { MongooseModule, getConnectionToken } from '@nestjs/mongoose'
import idValidator from 'mongoose-id-validator'

import { AssembliesModule } from '../assemblies/assemblies.module'
import { RefSeqsModule } from '../refSeqs/refSeqs.module'

import { JBrowseController } from './jbrowse.controller'
import { JBrowseService } from './jbrowse.service'

@Module({
  controllers: [JBrowseController],
  imports: [
    // AssembliesModule,
    forwardRef(() => AssembliesModule),
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
