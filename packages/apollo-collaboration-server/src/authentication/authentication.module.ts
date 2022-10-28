import { Module } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'
import { PassportModule } from '@nestjs/passport'

import { UsersModule } from '../users/users.module'
import { jwtConstants } from '../utils/constants'
import { AzureADStrategy } from '../utils/strategies/azure-ad.strategy'
import { GoogleStrategy } from '../utils/strategies/google.strategy'
import { JwtStrategy } from '../utils/strategies/jwt.strategy'
import { LocalStrategy } from '../utils/strategies/local.strategy'
import { AuthenticationController } from './authentication.controller'
import { AuthenticationService } from './authentication.service'

@Module({
  imports: [
    UsersModule,
    PassportModule,
    JwtModule.register({
      secret: jwtConstants.secret,
      signOptions: { expiresIn: jwtConstants.expiresIn },
    }),
  ],
  controllers: [AuthenticationController],
  providers: [
    AuthenticationService,
    LocalStrategy,
    JwtStrategy,
    GoogleStrategy,
    AzureADStrategy,
  ],
  exports: [AuthenticationService],
})
export class AuthenticationModule {}
