/* eslint-disable @typescript-eslint/no-unnecessary-condition */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import fs from 'node:fs/promises'

import { JWTPayload } from '@apollo-annotation/shared'
import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { JwtService } from '@nestjs/jwt'
import { Request } from 'express'
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

export interface RequestWithUserToken extends Request {
  user: { token: string }
}

interface ConfigValues {
  MICROSOFT_CLIENT_ID?: string
  MICROSOFT_CLIENT_ID_FILE?: string
  GOOGLE_CLIENT_ID?: string
  GOOGLE_CLIENT_ID_FILE?: string
  ALLOW_GUEST_USER: boolean
  DEFAULT_NEW_USER_ROLE: Role
  ROOT_USER_PASSWORD: string
}

const ROOT_USER_NAME = 'root'

@Injectable()
export class AuthenticationService {
  private readonly logger = new Logger(AuthenticationService.name)
  private defaultNewUserRole: Role

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService<ConfigValues, true>,
  ) {
    this.defaultNewUserRole = configService.get('DEFAULT_NEW_USER_ROLE', {
      infer: true,
    })
  }

  handleRedirect(req: RequestWithUserToken) {
    if (!req.user) {
      throw new BadRequestException()
    }

    const { redirect_uri } = (
      req.authInfo as { state: { redirect_uri: string } }
    ).state
    const url = new URL(redirect_uri)
    const searchParams = new URLSearchParams({ access_token: req.user.token })
    url.search = searchParams.toString()
    return { url: url.toString() }
  }

  async getLoginTypes() {
    const loginTypes: string[] = []
    let microsoftClientID = this.configService.get('MICROSOFT_CLIENT_ID', {
      infer: true,
    })
    if (!microsoftClientID) {
      const clientIDFile = this.configService.get('MICROSOFT_CLIENT_ID_FILE', {
        infer: true,
      })
      microsoftClientID =
        clientIDFile && (await fs.readFile(clientIDFile, 'utf8'))
      microsoftClientID = clientIDFile?.trim()
    }
    let googleClientID = this.configService.get('GOOGLE_CLIENT_ID', {
      infer: true,
    })
    if (!googleClientID) {
      const clientIDFile = this.configService.get('GOOGLE_CLIENT_ID_FILE', {
        infer: true,
      })
      googleClientID = clientIDFile && (await fs.readFile(clientIDFile, 'utf8'))
      googleClientID = clientIDFile?.trim()
    }
    const allowGuestUser = this.configService.get('ALLOW_GUEST_USER', {
      infer: true,
    })
    if (microsoftClientID) {
      loginTypes.push('microsoft')
    }
    if (googleClientID) {
      loginTypes.push('google')
    }
    if (allowGuestUser) {
      loginTypes.push('guest')
    }
    return loginTypes
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

  async rootLogin(password: string) {
    if (password === this.configService.get('ROOT_USER_PASSWORD')) {
      return this.logIn(ROOT_USER_NAME, ROOT_USER_EMAIL)
    }
    throw new UnauthorizedException('Invalid password for ROOT user')
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
      const isRootUser = name === ROOT_USER_NAME && email === ROOT_USER_EMAIL
      if (isRootUser) {
        newUserRole = Role.Admin
      } else {
        const users = await this.usersService.findAll()
        const hasAdmin = users.some(
          (user) =>
            user.role === Role.Admin &&
            user.email !== 'root_user' &&
            user.email !== 'guest_user',
        )
        // If there is not a non-guest and non-root user yet, the 1st user to
        // log in will be made an admin
        newUserRole = hasAdmin ? this.defaultNewUserRole : Role.Admin
      }
      const newUser: CreateUserDto = {
        email,
        username: name,
        role: newUserRole,
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
