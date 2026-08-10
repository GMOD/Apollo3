import type { JWTPayload } from '@apollo-annotation/shared'
import type { Request } from 'express'

/**
 * The user JwtAuthGuard attaches to a request. Anonymous requests get a
 * pseudo-user carrying only a role, so every field is optional.
 */
export type RequestUser = Partial<JWTPayload>

export interface RequestWithUser extends Request {
  user?: RequestUser
}

export function getRequestUser(request: Request): RequestUser | undefined {
  return (request as RequestWithUser).user
}
