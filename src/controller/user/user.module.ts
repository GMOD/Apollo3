import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import Grails_user from '../../entity/grails_user.entity';
import { UserController } from './user.controller';
import { UserService } from './user.service';

@Module({
  imports: [TypeOrmModule.forFeature([Grails_user])],
  controllers: [UserController],
  providers: [UserService]
})
export class UserModule {}
