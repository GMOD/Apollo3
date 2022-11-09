import { Injectable, Logger, UnauthorizedException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { Profile as GoogleProfile } from 'passport-google-oauth20'

import { CreateUserDto } from '../users/dto/create-user.dto'
import { UsersService } from '../users/users.service'
import { Role, RoleInheritance } from '../utils/role/role.enum'
import { Profile as MicrosoftProfile } from '../utils/strategies/microsoft.strategy'

@Injectable()
export class AuthenticationService {
  private readonly logger = new Logger(AuthenticationService.name)

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  /**
   * Log in with google
   * @param profile - profile
   * @returns Return either token with HttpResponse status 'HttpStatus.OK' OR null with 'HttpStatus.UNAUTHORIZED'
   */
  async googleLogin(profile: GoogleProfile) {
    const userRoles = new Set<Role>()
    const { DEFAULT_NEW_USER_ROLE } = process.env
    if (!DEFAULT_NEW_USER_ROLE) {
      throw new Error('No DEFAULT_NEW_USER_ROLE found in .env file')
    }
    let defaultRole = DEFAULT_NEW_USER_ROLE
    if (!profile._json.email) {
      throw new UnauthorizedException('No email provided')
    }
    // Find user from Mongo
    const userFound = await this.usersService.findByEmail(profile._json.email)
    if (!userFound) {
      if ((await this.usersService.getCount()) === 0) {
        defaultRole = Role.Admin // If there is no any user yet, the 1st user role will be admin
      }
      const newUser: CreateUserDto = {
        email: profile._json.email,
        role: [defaultRole],
        username: profile._json.name ? profile._json.name : 'na',
      }
      await this.usersService.addNew(newUser)

      const payload = {
        username: newUser.username,
        email: newUser.email,
        roles: Array.from(userRoles),
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
    this.logger.debug(`User found in Mongo: ${JSON.stringify(userFound)}`)

    // Loop user's role(s) and add each role + inherited ones to userRolesArray
    for (const userRole of userFound.role) {
      const roles = RoleInheritance[userRole] // Read from role.enum.ts
      roles.forEach((role) => {
        userRoles.add(role)
      })
    }

    const payload = {
      username: userFound.username,
      email: userFound.email,
      roles: Array.from(userRoles),
    }
    // Return token with SUCCESS status
    const returnToken = this.jwtService.sign(payload)
    this.logger.debug(
      `Login successful. Apollo token: ${JSON.stringify(returnToken)}`,
    )
    return { token: returnToken }
  }

  /**
   * Log in with microsoft
   * @param profile - profile
   * @returns Return either token with HttpResponse status 'HttpStatus.OK' OR null with 'HttpStatus.UNAUTHORIZED'
   */
  async microsoftLogin(profile: MicrosoftProfile) {
    const userRoles = new Set<Role>()
    const { DEFAULT_NEW_USER_ROLE } = process.env
    if (!DEFAULT_NEW_USER_ROLE) {
      throw new Error('No DEFAULT_NEW_USER_ROLE found in .env file')
    }
    let defaultRole = DEFAULT_NEW_USER_ROLE
    const [email] = profile.emails
    if (!email) {
      throw new UnauthorizedException('No email provided')
    }
    // Find user from Mongo
    const userFound = await this.usersService.findByEmail(email.value)
    if (!userFound) {
      if ((await this.usersService.getCount()) === 0) {
        defaultRole = Role.Admin // If there is no any user yet, the 1st user role will be admin
      }
      const newUser: CreateUserDto = {
        email: email.value,
        role: [defaultRole],
        username: profile.displayName ? profile.displayName : 'na',
      }
      await this.usersService.addNew(newUser)

      const payload = {
        username: newUser.username,
        email: newUser,
        roles: Array.from(userRoles),
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
    this.logger.debug(`User found in Mongo: ${JSON.stringify(userFound)}`)

    // Loop user's role(s) and add each role + inherited ones to userRolesArray
    for (const userRole of userFound.role) {
      const roles = RoleInheritance[userRole] // Read from role.enum.ts
      roles.forEach((role) => {
        userRoles.add(role)
      })
    }

    const payload = {
      username: userFound.username,
      email: userFound.email,
      roles: Array.from(userRoles),
    }
    // Return token with SUCCESS status
    const returnToken = this.jwtService.sign(payload)
    this.logger.debug(
      `Login successful. Apollo token: ${JSON.stringify(returnToken)}`,
    )
    return { token: returnToken }
  }
}
