/* eslint-disable @typescript-eslint/no-unsafe-return */
import type { JWTPayload } from '@apollo-annotation/shared'
import { type ExecutionContext, Injectable, Logger } from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'

import { Role } from './role/role.enum.js'

export const IS_PUBLIC_KEY = 'isPublic'

// passport-jwt's `info` when the request simply has no token (anonymous access)
const NO_TOKEN_MESSAGE = 'No auth token'

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  private readonly logger = new Logger(JwtAuthGuard.name)

  handleRequest(
    err: Error | undefined,
    user: JWTPayload | undefined,
    info: unknown,
    context: ExecutionContext,
    status?: unknown,
  ) {
    if (err) {
      this.logger.warn(`Authentication failed: ${err.message}`)
      throw err
    }
    if (!user) {
      // A token was sent but rejected (e.g. expired or bad signature); the
      // request continues without a role
      if (info instanceof Error && info.message !== NO_TOKEN_MESSAGE) {
        this.logger.warn(`Rejected auth token: ${info.message}`)
      }
      return { role: Role.None }
    }
    return super.handleRequest(err, user, info, context, status)
  }
}
