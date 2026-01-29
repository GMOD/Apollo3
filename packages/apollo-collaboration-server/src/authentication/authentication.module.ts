import fs from 'node:fs/promises'

import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { JwtModule, type JwtModuleOptions } from '@nestjs/jwt'
import { PassportModule } from '@nestjs/passport'

import { UsersModule } from '../users/users.module.js'
import { GoogleStrategy } from '../utils/strategies/google.strategy.js'
import { JwtStrategy } from '../utils/strategies/jwt.strategy.js'
import { MicrosoftStrategy } from '../utils/strategies/microsoft.strategy.js'

import { AuthenticationController } from './authentication.controller.js'
import { AuthenticationService } from './authentication.service.js'

interface JWTSecretConfig {
  JWT_SECRET?: string
  JWT_SECRET_FILE?: string
}

async function jwtConfigFactory(
  configService: ConfigService<JWTSecretConfig, true>,
): Promise<JwtModuleOptions> {
  let jwtSecret = configService.get('JWT_SECRET', { infer: true })
  if (!jwtSecret) {
    // We can use non-null assertion since joi already checks this for us
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const jwtFile = configService.get('JWT_SECRET_FILE', { infer: true })!
    const jwtFileText = await fs.readFile(jwtFile, 'utf8')
    jwtSecret = jwtFileText.trim()
  }
  return { secret: jwtSecret, signOptions: { expiresIn: '1d' } }
}

@Module({
  imports: [
    UsersModule,
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: jwtConfigFactory,
      inject: [ConfigService],
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
