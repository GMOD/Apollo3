import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Document, Schema as MongooseSchema, Types } from 'mongoose'
import { Assembly } from './assembly.schema';

export type TrackDocument = Track & Document

@Schema()
export class Track {
  @Prop({ required: true })
  type: string

  @Prop({ required: true })
  trackId: string

  @Prop({ required: true })
  name: string

  @Prop({ type: [MongooseSchema.Types.ObjectId], ref: 'Assembly', required: true })
  assemblyNames: Assembly[];

  @Prop({ type: [String], required: true })
  category: string[]

  @Prop({ type: Object, required: true })
  adapter: {
    type: string
    assemblyNames: string[]
    pafLocation: {
      locationType: string
      uri: string
    }
  }
}

export const TrackSchema = SchemaFactory.createForClass(Track)
