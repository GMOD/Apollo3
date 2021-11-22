import { Module } from '@nestjs/common'
import { APP_GUARD } from '@nestjs/core'
import { ConfigModule } from '@nestjs/config'
import { TypeOrmModule } from '@nestjs/typeorm'
import ApolloUser from '../../entity/grails_user.entity'
import { UserController } from './user.controller'
import { UserService } from './user.service'
import UserRole from '../../entity/userRole.entity'
import { GrailsUserRepository } from '../../repository/GrailsUserRepository'

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([ApolloUser, UserRole, GrailsUserRepository]),
  ],
  controllers: [UserController],
  providers: [UserService],
})
export class UserModule {}
