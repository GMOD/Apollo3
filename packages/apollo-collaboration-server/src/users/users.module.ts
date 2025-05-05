import { User, UserSchema } from '@apollo-annotation/schemas'
import { Module, OnApplicationBootstrap } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'

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
export class UsersModule implements OnApplicationBootstrap {
  constructor(private usersService: UsersService) {}
  onApplicationBootstrap() {
    return this.usersService.bootstrapDB()
  }
}
