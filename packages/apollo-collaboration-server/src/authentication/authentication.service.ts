import { Injectable, Logger, UnauthorizedException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'

import { User, UsersService } from '../users/users.service'
import { Role, RoleInheritance } from '../utils/role/role.enum'

@Injectable()
export class AuthenticationService {
  private readonly logger = new Logger(AuthenticationService.name)

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  /**
   * Validates username and password. THIS IS JUST FOR DEMO PURPOSE
   * @param username - Username
   * @param pass - Password
   * @returns User or null
   */
  async validateUser(username: string, pass: string) {
    // Check against hard-coded list of users
    const user = await this.usersService.findOne(username)
    if (user && user.password === pass) {
      const { password, ...result } = user
      return result
    }
    return null
  }

  /**
   * Check user's login attempt. TODO: THIS IS JUST FOR DEMO PURPOSE!
   * @param user - username
   * @returns Return either token with HttpResponse status 'HttpStatus.OK' OR null with 'HttpStatus.UNAUTHORIZED'
   */
  async login(user?: Omit<User, 'password'>) {
    if (!user) {
      throw new UnauthorizedException('No user provided')
    }
    // Find user from Mongo
    const userFound = await this.usersService.findByUsername(user.username)
    if (!userFound) {
      const errMsg = `User '${user.username}' not found in Mongo, no authorization!`
      this.logger.debug(errMsg)
      return {
        validationName: 'AuthorizationValidation',
        error: {
          message: errMsg,
        },
      }
    }
    this.logger.debug(`*** Found user from Mongo: ${JSON.stringify(userFound)}`)

    const userRoles = new Set<Role>()
    // Loop user's role(s) and add each role + inherited ones to userRolesArray
    for (const userRole of userFound.role) {
      const roles = RoleInheritance[userRole] // Read from role.enum.ts
      roles.forEach((role) => {
        userRoles.add(role)
      })
    }

    const payload = {
      username: user.username,
      sub: user.userId,
      roles: Array.from(userRoles),
    }
    // Return token with SUCCESS status
    const returnToken = this.jwtService.sign(payload)
    this.logger.debug(
      `Login successful. Issued token: ${JSON.stringify(returnToken)}`,
    )
    return { token: returnToken }
  }
}
