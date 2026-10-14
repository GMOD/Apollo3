import type { Connection } from 'mongoose'

/** A role a user can have in Apollo */
export type UserRole = 'admin' | 'user' | 'readOnly' | 'none'

/** Passed to the `Apollo-UserRole` extension point callback */
export interface UserRoleProps {
  /** The email address of the user logging in */
  email: string
  /** The display name of the user logging in */
  name: string
  /**
   * The login type the user logged in with, e.g. `google` or the name of a
   * provider in `OIDC_PROVIDERS` or a custom login type
   */
  loginType: string
  /**
   * The claims from the identity provider's ID token (merged with its userinfo
   * response if the token had no email), for OIDC logins. Custom logins have
   * no claims.
   */
  claims?: Record<string, unknown>
  /** Whether this is the user's first time logging in */
  isNewUser: boolean
  /** The Mongoose connection to the Apollo database */
  connection: Connection
}
