import type { Request } from 'express'

export interface AuthHandlerRedirect {
  url: string
}

export interface AuthHandlerUser {
  name: string
  email: string
}

/**
 * A custom login method contributed via the `Apollo-RegisterCustomAuth`
 * extension point.
 */
export interface CustomAuthHandler {
  message: string
  needsPopup: boolean
  handler: (
    request: Request,
    redirectUri?: string,
  ) => Promise<AuthHandlerRedirect | AuthHandlerUser>
}
