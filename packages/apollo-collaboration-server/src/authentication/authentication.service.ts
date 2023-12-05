import { Injectable, Logger, UnauthorizedException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { JwtService } from '@nestjs/jwt'
import { JWTPayload } from 'apollo-shared'
import { Profile as GoogleProfile } from 'passport-google-oauth20'

import { CreateUserDto } from '../users/dto/create-user.dto'
import { UsersService } from '../users/users.service'
import {
  GUEST_USER_EMAIL,
  GUEST_USER_NAME,
  ROOT_USER_EMAIL,
} from '../utils/constants'
import { Role } from '../utils/role/role.enum'
import { Profile as MicrosoftProfile } from '../utils/strategies/microsoft.strategy'

@Injectable()
export class AuthenticationService {
  private readonly logger = new Logger(AuthenticationService.name)
  private defaultNewUserRole: Role | 'none'

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService<
      {
        DEFAULT_NEW_USER_ROLE: Role | 'none'
        ALLOW_GUEST_USER: boolean
        ROOT_USER_NAME: string
        ROOT_USER_PASSWORD: string
      },
      true
    >,
  ) {
    this.defaultNewUserRole = configService.get('DEFAULT_NEW_USER_ROLE', {
      infer: true,
    })
  }

  /**
   * Log in with google
   * @param profile - profile
   * @returns Return either token with HttpResponse status 'HttpStatus.OK' OR null with 'HttpStatus.UNAUTHORIZED'
   */
  async googleLogin(profile: GoogleProfile) {
    if (!profile._json.email) {
      throw new UnauthorizedException('No email provided')
    }
    const { email, name } = profile._json
    return this.logIn(name ?? 'N/A', email)
  }

  /**
   * Log in with microsoft
   * @param profile - profile
   * @returns Return either token with HttpResponse status 'HttpStatus.OK' OR null with 'HttpStatus.UNAUTHORIZED'
   */
  async microsoftLogin(profile: MicrosoftProfile) {
    const [email] = profile.emails
    if (!email) {
      throw new UnauthorizedException('No email provided')
    }
    const { displayName } = profile
    return this.logIn(displayName, email.value)
  }

  /**
   * Log in as a guest
   * @returns Return either token with HttpResponse status 'HttpStatus.OK' OR null with 'HttpStatus.UNAUTHORIZED'
   */
  async guestLogin() {
    const allowGuestUser = this.configService.get('ALLOW_GUEST_USER', {
      infer: true,
    })
    if (allowGuestUser) {
      return this.logIn(GUEST_USER_NAME, GUEST_USER_EMAIL)
    }
    throw new UnauthorizedException('Guest users are not allowed')
  }

  async rootLogin(username: string, password: string) {
    const root_user_name: string = this.configService.get('ROOT_USER_NAME')
    if (
      username === root_user_name &&
      password === this.configService.get('ROOT_USER_PASSWORD')
    ) {
      return this.logIn(root_user_name, ROOT_USER_EMAIL)
    }
    throw new UnauthorizedException(
      'Invalid username or password for ROOT user',
    )
  }

  /**
   * Log in
   * @param name - User's display name
   * @param email - User's email
   * @returns Return token with HttpResponse status 'HttpStatus.OK'
   */
  async logIn(name: string, email: string) {
    // Find user from Mongo
    let user = await this.usersService.findByEmail(email)
    if (!user) {
      let newUserRole = this.defaultNewUserRole
      const isRootUser =
        name === this.configService.get('ROOT_USER_NAME') &&
        email === ROOT_USER_EMAIL
      if (isRootUser) {
        newUserRole = Role.Admin
      } else {
        const userCount = await this.usersService.getCount()
        const guestUser = await this.usersService.findGuest()
        const hasAdmin = userCount > 1 || (userCount === 1 && !guestUser)
        // If there is not a non-guest user yet, the 1st user role will be admin
        newUserRole = hasAdmin ? this.defaultNewUserRole : Role.Admin
      }
      const newUser: CreateUserDto = { email, username: name }
      if (newUserRole !== 'none') {
        newUser.role = newUserRole
      }
      user = await this.usersService.addNew(newUser)
    }
    this.logger.debug(`User found in Mongo: ${JSON.stringify(user)}`)

    const payload: JWTPayload = {
      username: user.username,
      email: user.email,
      role: user.role,
      id: user.id,
    }
    // Return token with SUCCESS status
    const returnToken = this.jwtService.sign(payload)
    this.logger.debug(
      `First time login successful. Apollo token: ${JSON.stringify(
        returnToken,
      )}`,
    )
    return { token: returnToken }
  }
}
