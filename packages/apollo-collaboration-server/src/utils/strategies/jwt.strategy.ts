import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PassportStrategy } from '@nestjs/passport'
import { DecodedJWT } from 'apollo-shared'
import { ExtractJwt, Strategy } from 'passport-jwt'

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private readonly logger = new Logger(JwtStrategy.name)
  constructor(configService: ConfigService<{ JWT_SECRET: string }, true>) {
    const jwtSecret = configService.get('JWT_SECRET', { infer: true })
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwtSecret,
    })
  }

  validate(payload: DecodedJWT): DecodedJWT {
    return payload
  }
}
