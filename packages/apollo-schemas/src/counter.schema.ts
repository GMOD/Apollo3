import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import type { HydratedDocument } from 'mongoose'

export type CounterDocument = HydratedDocument<Counter>

@Schema()
export class Counter {
  @Prop({ default: 0, required: true })
  sequenceValue: number

  @Prop({ required: true })
  id: string
}

export const CounterSchema = SchemaFactory.createForClass(Counter)
