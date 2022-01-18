import { Injectable } from '@nestjs/common'
import { PassportStrategy } from '@nestjs/passport'
import { ExtractJwt, Strategy } from 'passport-jwt'

import { jwtConstants } from '../constants'
import { PayloadObject } from '../payloadObject'

export interface ValidatedUser {
  userId: string
  username: string
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwtConstants.secret,
    })
  }

  async validate(payload: PayloadObject): Promise<ValidatedUser> {
    return { userId: payload.sub, username: payload.username }
  }
}
