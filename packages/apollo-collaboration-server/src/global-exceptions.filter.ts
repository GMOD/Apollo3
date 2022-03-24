import {
  ArgumentsHost,
  Catch,
  UnprocessableEntityException,
} from '@nestjs/common'
import { BaseExceptionFilter } from '@nestjs/core'
import { Error } from 'mongoose'

@Catch()
export class GlobalExceptionsFilter extends BaseExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    let newException = exception
    if (
      exception instanceof Error.CastError ||
      exception instanceof Error.ValidationError
    ) {
      newException = new UnprocessableEntityException(exception.message)
    }
    super.catch(newException, host)
  }
}
