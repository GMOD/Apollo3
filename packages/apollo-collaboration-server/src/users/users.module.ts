import { User, UserSchema } from '@apollo-annotation/schemas'
import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'

import { MessagesModule } from '../messages/messages.module.js'

import { UsersController } from './users.controller.js'
import { UsersService } from './users.service.js'

@Module({
  controllers: [UsersController],
  providers: [UsersService],
  imports: [
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
    MessagesModule,
  ],
  exports: [UsersService, MongooseModule],
})
export class UsersModule {}
