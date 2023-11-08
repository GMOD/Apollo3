import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import type { CheckResultSnapshot } from 'apollo-mst'
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose'

export type CheckResultDocument = HydratedDocument<CheckResult>

@Schema()
export class CheckResult
  implements Omit<CheckResultSnapshot, '_id' | 'refSeq'>
{
  // Don't make this a @Prop since _id is already on a MongoDB document
  _id: Types.ObjectId

  @Prop()
  name: string

  @Prop({ type: [String], required: true, index: true })
  ids: string[]

  @Prop({
    required: true,
    index: true,
    type: MongooseSchema.Types.ObjectId,
    ref: 'RefSeq',
  })
  refSeq: Types.ObjectId

  @Prop({ required: true })
  start: number

  @Prop({ required: true })
  end: number

  @Prop({ default: false })
  ignored: boolean

  @Prop()
  message: string
}
export const CheckResultSchema = SchemaFactory.createForClass(CheckResult)

CheckResultSchema.index({ refSeq: 1, start: 1 })
CheckResultSchema.index({ refSeq: 1, end: 1 })
