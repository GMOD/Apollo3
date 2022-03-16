// import { Schema, SchemaFactory } from '@nestjs/mongoose'
import { Document, Schema } from 'mongoose'

// export type AssemblyDocument = Assembly & Document

// @Schema()
// export class Assembly {}

// export const AssemblySchema = SchemaFactory.createForClass(Assembly)

// import { Document } from 'mongoose'

export const AssemblySchema = new Schema({
  description: { type: String, required: true },
})
export interface AssemblyDocument extends Document {
  id: string
  description: string
}
