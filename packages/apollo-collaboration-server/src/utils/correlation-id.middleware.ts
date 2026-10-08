import { randomUUID } from 'node:crypto'

import { Injectable, type NestMiddleware } from '@nestjs/common'
import type { NextFunction, Request, Response } from 'express'

import { runWithCorrelationId } from './request-context.js'

export const CORRELATION_ID_HEADER = 'x-request-id'

/**
 * Assigns each HTTP request a correlation ID (reusing an incoming
 * `X-Request-Id` header if present), echoes it back as a response header, and
 * runs the rest of the request inside that ID's async context.
 */
@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const incoming = req.headers[CORRELATION_ID_HEADER]
    const correlationId =
      typeof incoming === 'string' && incoming.length > 0
        ? incoming
        : randomUUID()
    res.setHeader('X-Request-Id', correlationId)
    runWithCorrelationId(correlationId, next)
  }
}
