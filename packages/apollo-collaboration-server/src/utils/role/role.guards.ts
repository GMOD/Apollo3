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

import { PayloadObject } from '../payloadObject'
import { ChangePermission, ChangeTypes } from './role.changePermissions'
import { ROLES_KEY } from './role.decorator'
import { Role } from './role.enum'
import { UsersService } from '../../usersDemo/users.service'

@Injectable()
export class RolesGuard implements CanActivate {
  private readonly logger = new Logger(RolesGuard.name)

  constructor(private reflector: Reflector,
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

      this.logger.debug(
        `Decoded from token: username '${payloadObject.username}', id '${payloadObject.sub}'`,
      )
      // const user = await this.usersService.findOne('john')
      const user = await this.usersService.findAll()
      this.logger.debug(`User: ${JSON.stringify(user)}`)

      // In change controller's create() -method we have 2nd authorization check level
      if (
        callingClass === 'ChangesController' &&
        callingEndpoint === 'create'
      ) {
        type ChangeTypeArray = typeof ChangeTypes
        const typeName = req.body.typeName as ChangeTypeArray
        this.logger.debug(`Request type name '${typeName}'`)
        const additionalRequiredRole = ChangePermission[typeName]
        this.logger.debug(
          `Additional required role is '${additionalRequiredRole}'`,
        )
      }

      // TODO: Check from database if user has required role
      for (const role of requiredRoles) {
        this.logger.debug(`Role '${role}' required`)
        if (payloadObject.username === 'demo' && role === 'readOnly') {
          this.logger.debug(`Role found!`)
          return true
        }
        if (payloadObject.username === 'john') {
          this.logger.debug(`Role found!`)
          return true
        }
      }

      this.logger.debug(`Role not found, no authorization!`)
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
