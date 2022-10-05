import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { Request } from 'express'
import jwtDecode from 'jwt-decode'
import { of } from 'rxjs'

import { UsersService } from '../../usersDemo/users.service'
import { PayloadObject } from '../payloadObject'
import { Role, RoleInheritance, RoleNames } from '../role/role.enum'
import {
  ChangeTypePermission,
  ChangeTypes,
} from './validatation.changeTypePermissions'
import { ROLES_KEY } from './validatation.decorator'

@Injectable()
export class ValidationGuard implements CanActivate {
  private readonly logger = new Logger(ValidationGuard.name)

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
    const requiredRole = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ])
    try {
      // If no role was required in endpoint then return true
      if (!requiredRole) {
        return true
      }
      this.logger.debug(`Required role is '${requiredRole}'`)

      const req = context.switchToHttp().getRequest<Request>()
      const callingClass = context.getClass().name
      const callingEndpoint = context.getHandler().name

      this.logger.debug(
        `Calling class '${callingClass}' and endpoint '${callingEndpoint}'`,
      )

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
      this.logger.debug(`*** Found user from Mongo: ${JSON.stringify(user)}`)

      type RoleNameArray = typeof RoleNames
      const userRolesArray: Array<Role> = []
      // Loop user's role(s) and add each role + inherited ones to userRolesArray
      for (const userRole of user.role) {
        const roleName = userRole as unknown as RoleNameArray
        const roles = RoleInheritance[roleName] // Read from role.enum.ts
        userRolesArray.push(...roles)
      }

      // In change controller's create() -method we have 2nd authorization check level.
      // Each change type has own permissions as defined in validation.changeTypePermissions.ts
      if (
        callingClass === 'ChangesController' &&
        callingEndpoint === 'create' // i.e. "submit change"
      ) {
        type ChangeTypeArray = typeof ChangeTypes
        const typeName = req.body.typeName as ChangeTypeArray
        const additionalRequiredRole = ChangeTypePermission[typeName] // Read from validation.changeTypePermissions.ts
        this.logger.debug(
          `Change type is '${typeName}' and an additional required role is '${additionalRequiredRole}'`,
        )
        const tmpRole: any = additionalRequiredRole
        if (!userRolesArray.includes(tmpRole)) {
          this.logger.debug(
            `User '${username}' doesn't have additional role '${additionalRequiredRole}'!`,
          )
          return false
        }
      }

      // Check if user has required role
      for (const role of requiredRole) {
        const tmpRole1: any = role
        if (userRolesArray.includes(tmpRole1)) {
          this.logger.debug(`User '${username}' has role '${tmpRole1}'`)
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
