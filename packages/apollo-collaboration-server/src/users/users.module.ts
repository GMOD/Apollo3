import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { User, UserSchema } from 'apollo-schemas'

import { UsersController } from './users.controller'
import { UsersService } from './users.service'

@Module({
  controllers: [UsersController],
  providers: [UsersService],
  imports: [
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
  ],
<<<<<<< HEAD
  exports: [UsersService, MongooseModule],
=======
  exports: [MongooseModule],
>>>>>>> UserChange class to propagate role change to mongoose
})
export class UsersModule {}
