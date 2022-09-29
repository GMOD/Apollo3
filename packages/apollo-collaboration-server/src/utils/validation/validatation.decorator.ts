import { SetMetadata } from '@nestjs/common'

import { Role } from '../role/role.enum'

export const ROLES_KEY = 'roles'
export const Validations = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles)