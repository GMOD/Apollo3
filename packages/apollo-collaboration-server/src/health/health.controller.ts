import { Controller, Get } from '@nestjs/common'
import { HealthCheck, HealthCheckService } from '@nestjs/terminus'

import { Public } from '../utils/jwt-auth.guard'

@Controller('health')
export class HealthController {
  constructor(private health: HealthCheckService) {}

  @Public()
  @Get()
  @HealthCheck()
  check() {
    return this.health.check([])
  }
}
