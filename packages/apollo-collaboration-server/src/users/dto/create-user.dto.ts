export class CreateUserDto {
<<<<<<< HEAD
  readonly email: string
  readonly username: string
  readonly role?: string[]
=======
  readonly id: number
  readonly username?: string
  readonly email?: string
  readonly role?: [{ type: string }]
>>>>>>> update users dto/entity
}
