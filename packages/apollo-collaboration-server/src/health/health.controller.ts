import fs from 'node:fs'

import { Controller, Get } from '@nestjs/common'
import {
  HealthCheck,
  HealthCheckService,
  HealthIndicatorService,
  MongooseHealthIndicator,
} from '@nestjs/terminus'

import { MessagesService } from '../messages/messages.service.js'
import { Role } from '../utils/role/role.enum.js'
import { Validations } from '../utils/validation/validatation.decorator.js'

// Read at runtime rather than imported so the build doesn't need to copy
// package.json into dist. This file sits at src/health/ or dist/health/, so
// package.json is two levels up either way.
const { version } = JSON.parse(
  fs.readFileSync(new URL('../../package.json', import.meta.url), 'utf8'),
) as { version: string }

@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private healthIndicatorService: HealthIndicatorService,
    private mongoose: MongooseHealthIndicator,
    private messagesService: MessagesService,
  ) {}

  /**
   * Whether this process can serve requests: it can reach MongoDB and is
   * receiving live updates from other server processes. Suitable for a load
   * balancer health check or a Kubernetes readiness probe.
   */
  @Validations(Role.None)
  @Get()
  @HealthCheck()
  check() {
    return this.health.check([
      () => this.mongoose.pingCheck('mongodb'),
      () => this.serverEventsCheck(),
    ])
  }

  /**
   * Whether this process is running, regardless of MongoDB. Suitable for a
   * Kubernetes liveness probe, so a MongoDB outage doesn't restart every
   * server process.
   */
  @Validations(Role.None)
  @Get('live')
  @HealthCheck()
  live() {
    return this.health.check([])
  }

  /**
   * The server's version, so clients can confirm they match it
   */
  @Validations(Role.None)
  @Get('version')
  getVersion() {
    return { version }
  }

  private serverEventsCheck() {
    const indicator = this.healthIndicatorService.check('serverEvents')
    return this.messagesService.isTailing() ? indicator.up() : indicator.down()
  }
}
