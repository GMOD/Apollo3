import { Module } from '@nestjs/common'
import { getConnectionToken, MongooseModule } from '@nestjs/mongoose'
import idValidator from 'mongoose-id-validator'
import { Assembly, AssemblySchema } from '../assemblies/schemas/assembly.schema'
import { Feature, FeatureSchema } from '../features/schemas/feature.schema'
import { RefseqsController } from './refseqs.controller'
import { RefseqsService } from './refseqs.service'
import { RefSeq, RefSeqSchema } from './schemas/refSeq.schema'

@Module({
  controllers: [RefseqsController],
  providers: [RefseqsService],
  imports: [
    MongooseModule.forFeature([
      { name: Assembly.name, schema: AssemblySchema },
    ]),
    MongooseModule.forFeature([{ name: RefSeq.name, schema: RefSeqSchema }]),
    MongooseModule.forFeature([{ name: Feature.name, schema: FeatureSchema }]),
    MongooseModule.forFeatureAsync([
      {
        name: RefSeq.name,
        useFactory: (connection) => {
          RefSeqSchema.plugin(idValidator, { connection })
          return RefSeqSchema
        },
        inject: [getConnectionToken()],
      },
    ]),
  ],
})
export class RefseqsModule {}
