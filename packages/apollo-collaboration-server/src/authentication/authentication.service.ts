import { Injectable, Logger } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'

import { UsersService } from '../usersDemo/users.service'

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
  async login(user: any) {
    const payload = { username: user.username, sub: user.userId }
    // Return token with SUCCESS status
    const returnToken = this.jwtService.sign(payload)
    this.logger.debug(
      `Login successful. Issued token: ${JSON.stringify(returnToken)}`,
    )
    return { token: returnToken }
  }
}
