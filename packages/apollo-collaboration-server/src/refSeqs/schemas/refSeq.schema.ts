import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Document, model } from 'mongoose'
import * as mongoose from 'mongoose'
import { Assembly } from '../../assemblies/schemas/assembly.schema'
export type RefSeqDocument = RefSeq & Document

@Schema()
export class RefSeq {
  @Prop({
    required: true, 
    index: true, 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Assembly',
  })
  assemblyId: Assembly

  @Prop({ required: true })
  name: string

  @Prop({ required: true })
  description: string

  @Prop({ required: true })
  length: number
}
export const RefSeqSchema = SchemaFactory.createForClass(RefSeq)
