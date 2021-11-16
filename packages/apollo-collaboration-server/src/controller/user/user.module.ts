import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { TypeOrmModule } from '@nestjs/typeorm'

import ApolloUser from '../../entity/grails_user.entity'
import UserRole from '../../entity/userRole.entity'
import { GrailsUserRepository } from '../../repository/GrailsUserRepository'
import { UserController } from './user.controller'
import { UserService } from './user.service'

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([ApolloUser, UserRole, GrailsUserRepository]),
  ],
  controllers: [UserController],
  providers: [UserService],
})
export class UserModule {}
