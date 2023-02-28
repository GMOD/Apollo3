import fs from 'fs'

import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PassportStrategy } from '@nestjs/passport'
import { DecodedJWT } from 'apollo-shared'
import { ExtractJwt, Strategy } from 'passport-jwt'

interface JWTSecretConfig {
  JWT_SECRET?: string
  JWT_SECRET_FILE?: string
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private readonly logger = new Logger(JwtStrategy.name)
  constructor(configService: ConfigService<JWTSecretConfig, true>) {
    let jwtSecret = configService.get('JWT_SECRET', { infer: true })
    if (!jwtSecret) {
      // We can use non-null assertion since joi already checks this for us
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const uriFile = configService.get('JWT_SECRET_FILE', {
        infer: true,
      })!
      jwtSecret = fs.readFileSync(uriFile, 'utf-8').trim()
    }
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
