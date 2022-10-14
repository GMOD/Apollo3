import { Injectable, Logger } from '@nestjs/common'
import { PassportStrategy } from '@nestjs/passport'
import { JWTPayload } from 'apollo-shared'
import { ExtractJwt, Strategy } from 'passport-jwt'

import { User } from '../../users/users.service'
import { jwtConstants } from '../constants'

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private readonly logger = new Logger(JwtStrategy.name)
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwtConstants.secret,
    })
  }

  async validate(payload: JWTPayload): Promise<Omit<User, 'password'>> {
    return { email: payload.email, username: payload.username }
  }
}
