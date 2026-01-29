import { type ArgumentsHost, Catch, Logger } from '@nestjs/common'
import { BaseExceptionFilter } from '@nestjs/core'

@Catch()
export class GlobalExceptionsFilter extends BaseExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionsFilter.name)

  catch(exception: unknown, host: ArgumentsHost) {
    this.logger.error(exception)
    super.catch(exception, host)
  }
}
