import { Injectable, Logger, UnauthorizedException } from '@nestjs/common'
import { PassportStrategy } from '@nestjs/passport'
import { Profile, Strategy } from 'passport-google-oauth20'

import { AuthenticationService } from '../../authentication/authentication.service'
import { User } from '../../users/users.service'

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy) {
  private readonly logger = new Logger(GoogleStrategy.name)
  constructor(private readonly authService: AuthenticationService) {
    super({
      clientID:
        '1054515969695-3hpfg1gd0ld3sgj135kfgikolu86vv30.apps.googleusercontent.com',
      clientSecret: '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',
      callbackURL: 'http://localhost:3999/auth/google/redirect',
      scope: ['profile', 'email'],
    })
  }

  async validate(accessToken: string, refreshToken: string, profile: Profile) {
    console.log(accessToken)
    // console.log(refreshToken)
    // console.log(profile)
    const user = await this.authService.googleLogin(profile)
    console.log('Validate')
    console.log(user)
    const tmp = { id: user.id, username : user.username}
    console.log(tmp)
    // return tmp || null
    return null
  }
}
