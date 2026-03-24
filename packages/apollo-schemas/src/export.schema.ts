import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import {
  type HydratedDocument,
  Schema as MongooseSchema,
  Types,
} from 'mongoose'

export type ExportDocument = HydratedDocument<Export>

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
