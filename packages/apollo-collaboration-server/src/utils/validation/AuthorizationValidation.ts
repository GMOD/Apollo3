import { Logger } from '@nestjs/common'
import {
  Context,
  ValidationResult,
} from 'apollo-shared/src/Validations/Validation'

import { UsersService } from '../../users/users.service'
import { getDecodedAccessToken } from '../commonUtilities'
import { Role, RoleInheritance, RoleNames } from '../role/role.enum'
import {
  ChangeTypePermission,
  ChangeTypes,
} from './validatation.changeTypePermissions'
import { ROLES_KEY } from './validatation.decorator'

export async function backendPreValidateAuthorize(
  context: Context,
  usersService: UsersService,
): Promise<ValidationResult> {
  const logger = new Logger(backendPreValidateAuthorize.name)
  const requiredRole = context.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
    context.context.getHandler(),
    context.context.getClass(),
  ])

  // If no role was required in endpoint then return true
  if (!requiredRole) {
    return { validationName: 'AuthorizationValidation' }
  }
  logger.debug(`Required role is '${requiredRole}'`)

  const req = context.context.switchToHttp().getRequest<Request>()
  const callingClass = context.context.getClass().name
  const callingEndpoint = context.context.getHandler().name

  logger.debug(
    `Calling class '${callingClass}' and endpoint '${callingEndpoint}'`,
  )

  const { authorization } = context.context.switchToHttp().getRequest().headers
  if (!authorization) {
    throw new Error('No "authorization" header')
  }
  const token = authorization.split(' ')
  const payloadObject = getDecodedAccessToken(token[1])
  const { username } = payloadObject

  const user = await usersService.findByUsername(username)
  if (!user) {
    const errMsg = `User '${username}' not found in Mongo, no authorization!`
    logger.debug(errMsg)
    return {
      validationName: 'AuthorizationValidation',
      error: {
        message: errMsg,
      },
    }
  }
  logger.debug(`*** Found user from Mongo: ${JSON.stringify(user)}`)

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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { typeName } = req.body as any
    const typeNameArray = typeName as ChangeTypeArray
    const additionalRequiredRole = ChangeTypePermission[typeNameArray] // Read from validation.changeTypePermissions.ts
    logger.debug(
      `Change type is '${typeNameArray}' and an additional required role is '${additionalRequiredRole}'`,
    )
    const tmpRole: Role = additionalRequiredRole
    if (!userRolesArray.includes(tmpRole)) {
      const errMsg = `User '${username}' doesn't have additional role '${additionalRequiredRole}'!`
      logger.debug(errMsg)
      return {
        validationName: 'AuthorizationValidation',
        error: {
          message: errMsg,
        },
      }
    }
  }

  // Check if user has required role
  for (const role of requiredRole) {
    const tmpRole1: Role = role
    if (userRolesArray.includes(tmpRole1)) {
      logger.debug(`User '${username}' has role '${tmpRole1}'`)
      return { validationName: 'AuthorizationValidation' }
    }
  }

  const errMsg = `No authorized!`
  logger.debug(errMsg)
  return {
    validationName: 'AuthorizationValidation',
    error: {
      message: errMsg,
    },
  }
}
