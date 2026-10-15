import fs from 'node:fs'

import { Controller, Get } from '@nestjs/common'
import { HealthCheck, HealthCheckService } from '@nestjs/terminus'

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
  constructor(private health: HealthCheckService) {}

  @Validations(Role.None)
  @Get()
  @HealthCheck()
  check() {
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
}
