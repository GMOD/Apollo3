import { Module } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'
import { PassportModule } from '@nestjs/passport'

import { UsersModule } from '../usersDemo/users.module'
import { jwtConstants } from '../utils/constants'
import { JwtStrategy } from '../utils/strategies/jwt.strategy'
import { LocalStrategy } from '../utils/strategies/local.strategy'
import { AuthenticateController } from './authenticate.controller'
import { AuthenticateService } from './authenticate.service'

@Module({
  imports: [
    UsersModule,
    PassportModule,
    JwtModule.register({
      secret: jwtConstants.secret,
      signOptions: { expiresIn: '2400m' }, // Define token expiration time. TODO: Put value into property -file
    }),
  ],
  controllers: [AuthenticateController],
  providers: [AuthenticateService, LocalStrategy, JwtStrategy],
  exports: [AuthenticateService],
})
export class AuthenticateModule {}
