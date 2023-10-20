import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Document } from 'mongoose'

export type CheckReportDocument = CheckReport & Document

@Schema({ timestamps: true })
export class CheckReport {
  @Prop({ required: true })
  checkName: string

  @Prop({ type: [String], required: true, index: true })
  ids: string[] // feature or refSeq IDs of checked things

  @Prop({ required: true })
  pass: boolean

  @Prop()
  ignored: string // Enter user id here who has validated this check

  @Prop()
  problems: string // We'll figure out what exactly is in the problems later
}

export const CheckReportSchema = SchemaFactory.createForClass(CheckReport)