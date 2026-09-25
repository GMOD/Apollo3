import { ConsoleLogger } from '@nestjs/common'

import { getCorrelationId } from './request-context.js'

/**
 * ConsoleLogger that prefixes string messages with the current correlation ID
 * (if any). Non-string messages (e.g. raw Error objects) are passed through
 * untouched.
 */
export class ApolloLogger extends ConsoleLogger {
  private withCorrelationId(message: unknown): unknown {
    const correlationId = getCorrelationId()
    if (correlationId && typeof message === 'string') {
      return `[${correlationId}] ${message}`
    }
    return message
  }

  log(message: unknown, ...optionalParams: unknown[]) {
    super.log(this.withCorrelationId(message), ...optionalParams)
  }

  error(message: unknown, ...optionalParams: unknown[]) {
    super.error(this.withCorrelationId(message), ...optionalParams)
  }

  warn(message: unknown, ...optionalParams: unknown[]) {
    super.warn(this.withCorrelationId(message), ...optionalParams)
  }

  debug(message: unknown, ...optionalParams: unknown[]) {
    super.debug(this.withCorrelationId(message), ...optionalParams)
  }

  verbose(message: unknown, ...optionalParams: unknown[]) {
    super.verbose(this.withCorrelationId(message), ...optionalParams)
  }
}
