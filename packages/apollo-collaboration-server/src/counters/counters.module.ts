import { Counter, CounterSchema } from '@apollo-annotation/schemas'
import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'

import { CountersService } from './counters.service'

@Module({
  // controllers: [CountersController],
  providers: [CountersService],
  imports: [
    MongooseModule.forFeature([{ name: Counter.name, schema: CounterSchema }]),
  ],
  exports: [MongooseModule, CountersService],
})
export class CountersModule {}
