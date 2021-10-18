import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthenticateController } from './authenticate.controller';
import { AuthenticateService } from './authenticate.service';
import { UsersModule } from '../usersDemo/users.module';
import { jwtConstants } from '../utils/constants';
import { JwtStrategy } from '../utils/strategies/jwt.strategy';
import { LocalStrategy } from '../utils/strategies/local.strategy';

@Module({
  imports: [UsersModule,PassportModule,
    JwtModule.register({
      secret: jwtConstants.secret,
      signOptions: { expiresIn: '2400m' },
    }),
    ],
  controllers: [AuthenticateController],
  providers: [AuthenticateService, LocalStrategy, JwtStrategy],
  exports: [AuthenticateService],
})
export class AuthenticateModule {}

