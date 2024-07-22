import { Controller, Get } from '@nestjs/common'
import { HealthCheck, HealthCheckService } from '@nestjs/terminus'

import { Validations } from '../utils/validation/validatation.decorator'
import { Role } from '../utils/role/role.enum'

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
