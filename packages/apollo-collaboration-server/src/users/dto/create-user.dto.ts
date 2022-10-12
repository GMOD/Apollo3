export class CreateUserDto {
  readonly id: number
  readonly email?: string
  readonly username?: string
  readonly role?: string[]
}
