import { type Role } from '../../utils/role/role.enum.js'

export class CreateUserDto {
  readonly email: string
  readonly username: string
  role?: Role
}

export class UserLocationDto {
  readonly assemblyId: string
  readonly refSeq: string
  readonly start: string
  readonly end: string
}
