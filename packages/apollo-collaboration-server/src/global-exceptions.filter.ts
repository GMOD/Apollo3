import {
  type ArgumentsHost,
  Catch,
  HttpException,
  HttpStatus,
  type HttpServer,
  Logger,
} from '@nestjs/common'
import { type AbstractHttpAdapter, BaseExceptionFilter } from '@nestjs/core'

// Matches the body BaseExceptionFilter sends for unknown errors
const UNKNOWN_EXCEPTION_MESSAGE = 'Internal server error'

function describe(value: unknown): string {
  return value instanceof Error ? value.message : String(value)
}

/**
 * The single place exception content (message, cause, stack) is logged. Client
 * errors (4xx HttpExceptions) are logged at `warn` without a stack; everything
 * else is logged once at `error` with its stack.
 */
@Catch()
export class GlobalExceptionsFilter extends BaseExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionsFilter.name)

  catch(exception: unknown, host: ArgumentsHost) {
    this.logException(exception)
    super.catch(exception, host)
  }

  /**
   * Same response as BaseExceptionFilter, but without its own logging, which
   * would duplicate the line already written by `logException`
   */
  handleUnknownError(
    exception: unknown,
    host: ArgumentsHost,
    applicationRef: AbstractHttpAdapter | HttpServer,
  ) {
    const body = this.isHttpError(exception)
      ? { statusCode: exception.statusCode, message: exception.message }
      : {
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          message: UNKNOWN_EXCEPTION_MESSAGE,
        }
    const response: unknown = host.getArgByIndex(1)
    if (applicationRef.isHeadersSent(response)) {
      applicationRef.end(response)
    } else {
      applicationRef.reply(response, body, body.statusCode)
    }
  }

  private logException(exception: unknown) {
    if (!(exception instanceof Error)) {
      this.logger.error(`Unhandled non-Error exception: ${String(exception)}`)
      return
    }
    let { message } = exception
    if (exception.cause !== undefined) {
      message += ` (cause: ${describe(exception.cause)})`
    }
    if (exception instanceof HttpException) {
      const status = exception.getStatus()
      if (status < 500) {
        this.logger.warn(`${status} ${message}`)
        return
      }
    }
    this.logger.error(message, exception.stack)
  }
}
