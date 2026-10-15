/** Thrown when the user dismisses the login dialog without choosing a login */
export class LoginCancelledError extends Error {
  constructor() {
    super('User chose not to log in')
    this.name = 'LoginCancelledError'
  }
}

/** Thrown when the user tried to log in but it didn't work */
export class LoginFailedError extends Error {
  constructor(cause: unknown) {
    super(cause instanceof Error ? cause.message : String(cause), { cause })
    this.name = 'LoginFailedError'
  }
}
