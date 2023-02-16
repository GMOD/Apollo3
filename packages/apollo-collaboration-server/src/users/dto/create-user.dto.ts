import { Role } from '../../utils/role/role.enum'

export class CreateUserDto {
  readonly email: string
  readonly username: string
  readonly role?: Role
}

export class UserLocationDto {
  readonly assemblyId: string
  readonly refSeq: string
  readonly start: string
  readonly end: string
}
