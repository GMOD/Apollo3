import { SetMetadata } from '@nestjs/common'

import { type Role } from '../role/role.enum'

export const ROLE_KEY = 'role'
export const Validations = (role: Role) => SetMetadata(ROLE_KEY, role)
