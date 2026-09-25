import { AsyncResource } from 'node:async_hooks'

import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  Logger,
  type NestInterceptor,
} from '@nestjs/common'
import type { Request, Response } from 'express'
import type { Observable } from 'rxjs'

/**
 * Writes one access-log line per completed HTTP request (method, path, status,
 * duration). Never logs exception content; that is GlobalExceptionsFilter's job.
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP')

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle()
    }
    const http = context.switchToHttp()
    const req = http.getRequest<Request>()
    const res = http.getResponse<Response>()
    const start = performance.now()
    // Listen for "finish" so the status reflects the final response, including
    // one set by the exception filter or a streamed body. Bind the listener so it
    // keeps this request's correlation ID.
    const onFinish = AsyncResource.bind(() => {
      const duration = Math.round(performance.now() - start)
      const { statusCode } = res
      const line = `${req.method} ${req.originalUrl.split('?')[0]} ${statusCode} ${duration}ms`
      if (statusCode >= 400) {
        this.logger.warn(line)
      } else {
        this.logger.log(line)
      }
    })
    res.once('finish', onFinish)
    return next.handle()
  }
}
