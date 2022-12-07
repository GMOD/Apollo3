import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Document, Schema as MongooseSchema, Types } from 'mongoose'

export type ExportDocument = Export & Document

@Schema({ timestamps: true })
export class Export {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Assembly',
    required: true,
  })
  assembly: Types.ObjectId
}

export const ExportSchema = SchemaFactory.createForClass(Export)

ExportSchema.index({ createdAt: 1 }, { expireAfterSeconds: 300 })
