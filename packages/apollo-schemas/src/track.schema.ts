import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import {
  Document,
  Schema as MongooseSchema,
  Schema as SC,
  Types,
} from 'mongoose'

import { Assembly } from './assembly.schema'

export type TrackDocument = Track & Document

@Schema()
export class Track {
  @Prop({ required: true })
  type: string

  @Prop({ required: true })
  trackId: string

  @Prop({ required: true })
  trackConfig: SC.Types.Mixed
}

export const TrackSchema = SchemaFactory.createForClass(Track)
