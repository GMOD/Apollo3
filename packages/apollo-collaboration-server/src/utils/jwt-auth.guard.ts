/* eslint-disable @typescript-eslint/no-unsafe-return */
import type { JWTPayload } from '@apollo-annotation/shared'
import { type ExecutionContext, Injectable } from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'

import { Role } from './role/role.enum.js'

export const IS_PUBLIC_KEY = 'isPublic'
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  handleRequest(
    err: Error | undefined,
    user: JWTPayload | undefined,
    info: unknown,
    context: ExecutionContext,
    status?: unknown,
  ) {
    if (err) {
      throw err
    }
    if (!user) {
      return { role: Role.None }
    }
    return super.handleRequest(err, user, info, context, status)
  }
}
