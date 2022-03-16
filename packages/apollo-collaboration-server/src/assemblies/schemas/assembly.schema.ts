import { Schema, SchemaFactory } from '@nestjs/mongoose'
import { Document } from 'mongoose'

export type AssemblyDocument = Assembly & Document

@Schema()
export class Assembly {}

export const AssemblySchema = SchemaFactory.createForClass(Assembly)
