import { Schema, SchemaFactory } from '@nestjs/mongoose'
import { Document } from 'mongoose'

export type RefSeqDocument = RefSeq & Document

@Schema()
export class RefSeq {}

export const RefSeqSchema = SchemaFactory.createForClass(RefSeq)
