/* eslint-disable @typescript-eslint/no-unsafe-return */
import { JWTPayload } from '@apollo-annotation/shared'
import { ExecutionContext, Injectable } from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'

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
      return { role: 'none' }
    }
    return super.handleRequest(err, user, info, context, status)
  }
}
