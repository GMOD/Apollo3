import type { SerializedChange } from '@apollo-annotation/common'
import type { JWTPayload } from '@apollo-annotation/shared'
import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  Logger,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import type { Request } from 'express'

import { Role, RoleInheritance } from '../role/role.enum.js'

import { getRequiredRoleForChange } from './validatation.changeTypePermissions.js'
import { ROLE_KEY } from './validatation.decorator.js'

/**
 * Checks that the user has the role an endpoint requires (set with the
 * `@Validations(role)` decorator; endpoints without one require
 * `Role.Admin`). Submitting a change additionally requires the role for that
 * change type.
 */
@Injectable()
export class AuthorizationGuard implements CanActivate {
  private readonly logger = new Logger(AuthorizationGuard.name)

  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    try {
      const message = this.checkAuthorization(context)
      if (message) {
        this.logger.warn(`Not authorized: ${message}`)
        return false
      }
      return true
    } catch (error) {
      this.logger.error(
        'Authorization check failed',
        error instanceof Error ? error.stack : String(error),
      )
      return false
    }
  }

  /** Returns a message explaining why the user is not authorized, if they aren't */
  private checkAuthorization(context: ExecutionContext): string | undefined {
    // If endpoint does not require role, for security assume it needs Role.Admin
    const requiredRole =
      this.reflector.getAllAndOverride<Role | undefined>(ROLE_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? Role.Admin

    const request = context.switchToHttp().getRequest<Request>()
    const { user } = request as unknown as { user?: JWTPayload }
    if (!user) {
      throw new Error('No user attached to request')
    }
    const { role, username } = user

    // Each change type has its own required role, as defined in
    // validation.changeTypePermissions.ts
    if (
      context.getClass().name === 'ChangesController' &&
      context.getHandler().name === 'create' // i.e. "submit change"
    ) {
      const { typeName } = request.body as SerializedChange
      const requiredRoleForChange = getRequiredRoleForChange(typeName)
      this.logger.debug(
        `Change type is '${typeName}' and an additional required role is '${requiredRoleForChange}'`,
      )
      if (!role || !RoleInheritance[role].includes(requiredRoleForChange)) {
        return `User '${username}' doesn't have additional role '${requiredRoleForChange}'!`
      }
    }

    if (role && RoleInheritance[role].includes(requiredRole)) {
      return
    }
    return `User '${username}' doesn't have role '${requiredRole}'`
  }
}
