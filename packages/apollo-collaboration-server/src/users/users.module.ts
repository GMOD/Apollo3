import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { User, UserSchema } from 'apollo-schemas'

import { MessagesModule } from '../messages/messages.module'
import { UsersController } from './users.controller'
import { UsersService } from './users.service'

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
