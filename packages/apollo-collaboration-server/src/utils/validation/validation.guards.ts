import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnprocessableEntityException,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { InjectModel } from '@nestjs/mongoose'
import { User, UserDocument } from 'apollo-schemas'
import { validationRegistry } from 'apollo-shared'
import { Model } from 'mongoose'

import { UsersService } from '../../users/users.service'

@Injectable()
export class ValidationGuard implements CanActivate {
  private readonly logger = new Logger(ValidationGuard.name)

  constructor(
    private reflector: Reflector,
    private readonly usersService: UsersService,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
  ) {}

  /**
   * Check if user has such role that user is allowed to execute endpoint
   * @param context -
   * @returns TRUE: user is allowed to execute endpoint
   *          FALSE: user is not allowed to execute endpoint
   */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      const validationResult = await validationRegistry.backendPreValidate(
        {
          context,
          reflector: this.reflector,
        },
        this.userModel,
      )
      if (!validationResult.ok) {
        throw new UnprocessableEntityException(
          `Error in backend authorization pre-validation: ${validationResult.results}`,
        )
      }
      return true
    } catch (Exception) {
      this.logger.error(Exception)
      return false
    }
  }
}
