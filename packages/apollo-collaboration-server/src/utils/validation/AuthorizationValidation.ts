import { Logger } from '@nestjs/common'
import { UserDocument } from 'apollo-schemas'
import {
  Change,
  Context,
  SerializedChange,
  Validation,
  ValidationResult,
  isContext,
} from 'apollo-shared'
import type { Model } from 'mongoose'

import { getDecodedAccessToken } from '../commonUtilities'
import { Role, RoleInheritance } from '../role/role.enum'
import { getRequiredRoleForChange } from './validatation.changeTypePermissions'
import { ROLES_KEY } from './validatation.decorator'

export class AuthorizationValidation extends Validation {
  name = 'Authorization' as const
  async backendPreValidate(
    changeOrContext: Change | Context,
    { userModel }: { userModel: Model<UserDocument> },
  ): Promise<ValidationResult> {
    if (!isContext(changeOrContext)) {
      return { validationName: this.name }
    }
    const context = changeOrContext
    const logger = new Logger(AuthorizationValidation.name)
    const requiredRole = context.reflector.getAllAndOverride<Role[]>(
      ROLES_KEY,
      [context.context.getHandler(), context.context.getClass()],
    )

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

    const { authorization } = context.context
      .switchToHttp()
      .getRequest().headers
    if (!authorization) {
      throw new Error('No "authorization" header')
    }
    const [, token] = authorization.split(' ')
    const payloadObject = getDecodedAccessToken(token)
    const { username } = payloadObject

    const user = await userModel.findOne({ username })
    if (!user) {
      const errMsg = `User '${username}' not found in Mongo, no authorization!`
      logger.debug(errMsg)
      return { validationName: this.name, error: { message: errMsg } }
    }
    logger.debug(`*** Found user from Mongo: ${JSON.stringify(user)}`)

    const userRoles = new Set<Role>()
    // Loop user's role(s) and add each role + inherited ones to userRolesArray
    for (const userRole of user.role) {
      const roles = RoleInheritance[userRole] // Read from role.enum.ts
      roles.forEach((role) => {
        userRoles.add(role)
      })
    }

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
      if (!userRoles.has(requiredRoleForChange)) {
        const errMsg = `User '${username}' doesn't have additional role '${requiredRoleForChange}'!`
        logger.debug(errMsg)
        return { validationName: this.name, error: { message: errMsg } }
      }
    }

    // Check if user has required role
    for (const role of requiredRole) {
      if (userRoles.has(role)) {
        logger.debug(`User '${username}' has role '${role}'`)
        return { validationName: this.name }
      }
    }

    const errMsg = `Not authorized!`
    logger.debug(errMsg)
    return { validationName: this.name, error: { message: errMsg } }
  }
}
