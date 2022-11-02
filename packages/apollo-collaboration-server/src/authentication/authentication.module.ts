import { Module } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'
import { PassportModule } from '@nestjs/passport'

import { UsersModule } from '../users/users.module'
import { jwtConstants } from '../utils/constants'
import { GoogleStrategy } from '../utils/strategies/google.strategy'
import { JwtStrategy } from '../utils/strategies/jwt.strategy'
import { MicrosoftStrategy } from '../utils/strategies/microsoft.strategy'
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
    JwtStrategy,
    GoogleStrategy,
    MicrosoftStrategy,
  ],
  exports: [AuthenticationService],
})
export class AuthenticationModule {}
