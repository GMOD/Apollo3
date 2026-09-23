import type { JWTPayload } from '@apollo-annotation/shared'
import { validationRegistry } from '@apollo-annotation/shared'
import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import type { Request } from 'express'

import { Role } from '../role/role.enum.js'

@Injectable()
export class ValidationGuard implements CanActivate {
  private readonly logger = new Logger(ValidationGuard.name)

  constructor(private reflector: Reflector) {}

  /**
   * Check if user has such role that user is allowed to execute endpoint.
   * Throws UnauthorizedException (401) when the request has no authenticated
   * user at all, and ForbiddenException (403) when the user is authenticated
   * but lacks the required role.
   * @param context -
   * @returns TRUE: user is allowed to execute endpoint
   */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    let validationResult: Awaited<
      ReturnType<typeof validationRegistry.backendPreValidate>
    >
    try {
      validationResult = await validationRegistry.backendPreValidate({
        context,
        reflector: this.reflector,
      })
    } catch (error) {
      this.logger.error(error)
      return false
    }
    if (!validationResult.ok) {
      const message = `Error in backend authorization pre-validation: ${validationResult.resultsMessages}`
      this.logger.error(message)
      const { user } = context
        .switchToHttp()
        .getRequest<Request & { user?: JWTPayload }>()
      if (!user || user.role === Role.None) {
        throw new UnauthorizedException(message)
      }
      throw new ForbiddenException(message)
    }
    return true
  }
}
