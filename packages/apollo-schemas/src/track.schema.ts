import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Document, Schema as SC } from 'mongoose'

export type TrackDocument = Track & Document

@Schema()
export class Track {
  @Prop({ required: true })
  trackConfig: SC.Types.Mixed
}

export const TrackSchema = SchemaFactory.createForClass(Track)
