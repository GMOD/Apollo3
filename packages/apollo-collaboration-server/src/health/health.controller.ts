import { Controller, Get } from '@nestjs/common'
import { HealthCheck, HealthCheckService } from '@nestjs/terminus'

import { Role } from '../utils/role/role.enum'
import { Validations } from '../utils/validation/validatation.decorator'

@Controller('health')
export class HealthController {
  constructor(private health: HealthCheckService) {}

  @Validations(Role.None)
  @Get()
  @HealthCheck()
  check() {
    return this.health.check([])
  }
}
