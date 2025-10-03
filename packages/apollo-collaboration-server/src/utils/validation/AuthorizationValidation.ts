/* eslint-disable @typescript-eslint/require-await */
/* eslint-disable @typescript-eslint/no-unnecessary-condition */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { type Change, type SerializedChange } from '@apollo-annotation/common'
import {
  type Context,
  type JWTPayload,
  Validation,
  type ValidationResult,
  isContext,
} from '@apollo-annotation/shared'
import { Logger } from '@nestjs/common'
import { type Request } from 'express'

import { Role, RoleInheritance } from '../role/role.enum'

import { getRequiredRoleForChange } from './validatation.changeTypePermissions'
import { ROLE_KEY } from './validatation.decorator'

export class AuthorizationValidation extends Validation {
  name = 'Authorization' as const
  async backendPreValidate(
    changeOrContext: Change | Context,
  ): Promise<ValidationResult> {
    if (!isContext(changeOrContext)) {
      return { validationName: this.name }
    }
    const context = changeOrContext
    const logger = new Logger(AuthorizationValidation.name)
    let requiredRole = context.reflector.getAllAndOverride<Role>(ROLE_KEY, [
      context.context.getHandler(),
      context.context.getClass(),
    ])

    // If endpoint does not require role, for security assume it needs Role.Admin
    if (!requiredRole) {
      requiredRole = Role.Admin
    }
    logger.debug(`Required role is '${requiredRole}'`)

    const req = context.context.switchToHttp().getRequest<Request>()
    const callingClass = context.context.getClass().name
    const callingEndpoint = context.context.getHandler().name

    logger.debug(
      `Calling class '${callingClass}' and endpoint '${callingEndpoint}'`,
    )

    const request = context.context.switchToHttp().getRequest()
    const { user } = request as { user: JWTPayload }
    if (!user) {
      throw new Error('No user attached to request')
    }
    const { role, username } = user

    // In change controller's create() -method we have 2nd authorization check level.
    // Each change type has own permissions as defined in validation.changeTypePermissions.ts
    if (
      callingClass === 'ChangesController' &&
      callingEndpoint === 'create' // i.e. "submit change"
    ) {
      const { typeName } = req.body as unknown as SerializedChange
      const requiredRoleForChange = getRequiredRoleForChange(typeName) // Read from validation.changeTypePermissions.ts
      logger.debug(
        `Change type is '${typeName}' and an additional required role is '${requiredRoleForChange}'`,
      )
      if (
        !role ||
        (role && !RoleInheritance[role].includes(requiredRoleForChange))
      ) {
        const errMsg = `User '${username}' doesn't have additional role '${requiredRoleForChange}'!`
        logger.debug(errMsg)
        return { validationName: this.name, error: { message: errMsg } }
      }
    }

    // Check if user has required role
    if (role && RoleInheritance[role].includes(requiredRole)) {
      return { validationName: this.name }
    }

    const errMsg = 'Not authorized!'
    logger.debug(errMsg)
    return { validationName: this.name, error: { message: errMsg } }
  }
}
