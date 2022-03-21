// import { Schema, SchemaFactory } from '@nestjs/mongoose'
import { Document, Schema } from 'mongoose'

// export type RefSeqDocument = RefSeq & Document

// @Schema()
// export class RefSeq {}

// export const RefSeqSchema = SchemaFactory.createForClass(RefSeq)

export const RefSeqSchema = new Schema({
  assemblyId: { type: String, required: true },
  name: { type: String, required: true },
  description: { type: String, required: true },
  length: { type: Number, required: true },
})
export interface RefSeqDocument extends Document {
  id: string
  assemblyId: string
  name: string
  description: string
  length: number
}
