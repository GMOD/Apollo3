export class CreateUserDto {
  readonly email: string
  readonly username: string
  readonly role?: string[]
}
