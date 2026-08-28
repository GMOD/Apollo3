import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import {
  type HydratedDocument,
  Schema as MongooseSchema,
  Types,
} from 'mongoose'

export type JBrowseRefSeqDocument = HydratedDocument<JBrowseRefSeq>

@Schema()
export class JBrowseRefSeq {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'JBrowseAssembly',
    required: true,
    index: true,
  })
  assembly: Types.ObjectId

  @Prop({ required: true })
  name: string

  @Prop({ required: true })
  length: number
}

export const JBrowseRefSeqSchema = SchemaFactory.createForClass(JBrowseRefSeq)
