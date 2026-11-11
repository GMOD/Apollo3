import { SetMetadata, applyDecorators } from '@nestjs/common'
import { ApiBearerAuth, ApiExtension } from '@nestjs/swagger'

import { Role } from '../role/role.enum.js'

export const ROLE_KEY = 'role'

/**
 * Sets the minimum role needed to access a controller or route. Also records
 * the role in the generated OpenAPI document.
 */
export const Validations = (role: Role) =>
  role === Role.None
    ? applyDecorators(
        SetMetadata(ROLE_KEY, role),
        ApiExtension('x-apollo-role', role),
      )
    : applyDecorators(
        SetMetadata(ROLE_KEY, role),
        ApiBearerAuth(),
        ApiExtension('x-apollo-role', role),
      )
