import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnprocessableEntityException,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'

import { UsersService } from '../../users/users.service'
import { backendPreValidateAuthorize } from './AuthorizationValidation'

@Injectable()
export class ValidationGuard implements CanActivate {
  private readonly logger = new Logger(ValidationGuard.name)

  constructor(
    private reflector: Reflector,
    private readonly usersService: UsersService,
  ) {}

  /**
   * Check if user has such role that user is allowed to execute endpoint
   * @param context -
   * @returns TRUE: user is allowed to execute endpoint
   *          FALSE: user is not allowed to execute endpoint
   */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      const validationResult = await backendPreValidateAuthorize(
        {
          context,
          reflector: this.reflector,
        },
        this.usersService,
      )
      if (validationResult.error) {
        throw new UnprocessableEntityException(
          `Error in backend authorization pre-validation: ${validationResult.error.message}`,
        )
      }
      return true
    } catch (Exception) {
      this.logger.error(Exception)
      return false
    }
  }
}
