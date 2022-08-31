import {
  ArgumentsHost,
  Catch,
  Logger,
  UnprocessableEntityException,
} from '@nestjs/common'
import { BaseExceptionFilter } from '@nestjs/core'
import { Error } from 'mongoose'

@Catch()
export class GlobalExceptionsFilter extends BaseExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionsFilter.name)

  catch(exception: unknown, host: ArgumentsHost) {
    let newException = exception
    if (
      exception instanceof Error.CastError ||
      exception instanceof Error.ValidationError
    ) {
      newException = new UnprocessableEntityException(exception.message)
    }
    this.logger.error(newException)
    super.catch(newException, host)
  }
}
