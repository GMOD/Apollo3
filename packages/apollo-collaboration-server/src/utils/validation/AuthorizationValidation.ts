import { Logger } from '@nestjs/common'
import { Change, SerializedChange } from 'apollo-common'
import {
  Context,
  JWTPayload,
  Validation,
  ValidationResult,
  isContext,
} from 'apollo-shared'
import { Request } from 'express'

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
    const requiredRole = context.reflector.getAllAndOverride<Role>(ROLE_KEY, [
      context.context.getHandler(),
      context.context.getClass(),
    ])

    // If no role was required in endpoint then return true
    if (!requiredRole) {
      return { validationName: this.name }
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
    const { username, role } = user

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
