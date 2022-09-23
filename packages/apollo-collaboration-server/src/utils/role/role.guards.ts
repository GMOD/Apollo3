import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { Request } from 'express'
import jwtDecode from 'jwt-decode'
import { TruthyTypesOf } from 'rxjs'

import { UsersService } from '../../usersDemo/users.service'
import { PayloadObject } from '../payloadObject'
import { ChangePermission, ChangeTypes } from './role.changePermissions'
import { ROLES_KEY } from './role.decorator'
import { Role } from './role.enum'

@Injectable()
export class RolesGuard implements CanActivate {
  private readonly logger = new Logger(RolesGuard.name)

  constructor(
    private reflector: Reflector,
    private readonly usersService: UsersService,
  ) {}

  /**
   * Check if user has such role that user is allowed to execute endpoint
   * @param context -
   * @returns TRUE: user is allowed to execute endpoint
   *          FALSE: user is not allowed to execute endpoint
   */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ])
    try {
      // If no role was required in endpoint then return true
      if (!requiredRoles) {
        return true
      }
      this.logger.debug(`Required roles are '${requiredRoles}'`)

      const req = context.switchToHttp().getRequest<Request>()
      const callingClass = context.getClass().name
      const callingEndpoint = context.getHandler().name

      this.logger.debug(`Calling class '${callingClass}'`)
      this.logger.debug(`Calling endpoint '${callingEndpoint}'`)

      const authHeader = req.headers.authorization
      if (!authHeader) {
        throw new Error('No "authorization" header')
      }
      const token = authHeader.split(' ')
      const payloadObject = this.getDecodedAccessToken(token[1])
      const { username } = payloadObject

      const user = await this.usersService.findByUsername(username)
      if (!user) {
        this.logger.debug(
          `User '${username}' not found in Mongo, no authorization!`,
        )
        return false
      }
      this.logger.debug(`*** Found user: ${JSON.stringify(user)}`)

      // In change controller's create() -method we have 2nd authorization check level
      if (
        callingClass === 'ChangesController' &&
        callingEndpoint === 'create' // i.e. "submit change"
      ) {
        type ChangeTypeArray = typeof ChangeTypes
        const typeName = req.body.typeName as ChangeTypeArray
        this.logger.debug(`Request type name '${typeName}'`)
        const additionalRequiredRole = ChangePermission[typeName] // Read from role.changePermissions.ts
        this.logger.debug(
          `Additional required role is '${additionalRequiredRole}'`,
        )
        const tmpRole: any = additionalRequiredRole
        if (!user.role.includes(tmpRole)) {
          this.logger.debug(
            `User '${username}' doesn't have additional role '${additionalRequiredRole}'!`,
          )
          return false
        }
      }

      // Check if user has required role
      for (const role of requiredRoles) {
        this.logger.debug(`Role '${role}' required`)
        const tmpRole1: any = role
        if (user.role.includes(tmpRole1)) {
          this.logger.debug(`User '${username}' has role '${tmpRole1}'!`)
          return true
        }
      }

      this.logger.debug(`No authorized!`)
      return false
    } catch (Exception) {
      this.logger.error(Exception)
      return false
    }
  }

  /**
   * Decode access token
   * @param token -
   * @returns Decoded token
   */
  getDecodedAccessToken(token: string): PayloadObject {
    return jwtDecode(token)
  }
}
