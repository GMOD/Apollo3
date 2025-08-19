import { type CheckResultSnapshot } from '@apollo-annotation/mst'
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose'

export type CheckResultDocument = HydratedDocument<CheckResult>

@Schema()
export class CheckResult
  implements Omit<CheckResultSnapshot, '_id' | 'ids' | 'refSeq'>
{
  // Don't make this a @Prop since _id is already on a MongoDB document
  _id: Types.ObjectId

  @Prop()
  name: string

  @Prop()
  isDefault: boolean

  @Prop()
  cause: string

  @Prop({ type: [MongooseSchema.Types.ObjectId], required: true, index: true })
  ids: Types.ObjectId[]

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
