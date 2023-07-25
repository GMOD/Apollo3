import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnprocessableEntityException,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { validationRegistry } from 'apollo-shared'

@Injectable()
export class ValidationGuard implements CanActivate {
  private readonly logger = new Logger(ValidationGuard.name)

  constructor(private reflector: Reflector) {}

  /**
   * Check if user has such role that user is allowed to execute endpoint
   * @param context -
   * @returns TRUE: user is allowed to execute endpoint
   *          FALSE: user is not allowed to execute endpoint
   */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      const validationResult = await validationRegistry.backendPreValidate({
        context,
        reflector: this.reflector,
      })
      if (!validationResult.ok) {
        throw new UnprocessableEntityException(
          `Error in backend authorization pre-validation: ${validationResult.resultsMessages}`,
        )
      }
      return true
    } catch (error) {
      this.logger.error(error)
      return false
    }
  }
}
