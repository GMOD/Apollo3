import { Module, forwardRef } from '@nestjs/common'
import { MongooseModule, getConnectionToken } from '@nestjs/mongoose'
import { Track, TrackSchema } from '@apollo-annotation/schemas'
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
        name: Track.name,
        useFactory: (connection) => {
          TrackSchema.plugin(idValidator, { connection })
          return TrackSchema
        },
        inject: [getConnectionToken()],
      },
    ]),
    RefSeqsModule,
  ],
  providers: [JBrowseService],
  exports: [MongooseModule, JBrowseService],
})
export class JbrowseModule {}
