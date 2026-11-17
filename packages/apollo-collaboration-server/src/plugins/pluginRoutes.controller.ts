import { All, Controller, Logger, Req, Res } from '@nestjs/common'
import { ApiExcludeController } from '@nestjs/swagger'
import type { Request, Response } from 'express'

import { Role } from '../utils/role/role.enum.js'
import { Validations } from '../utils/validation/validatation.decorator.js'

import { PluginsService } from './plugins.service.js'

const ROUTES_PREFIX = '/plugin-routes'

// Left out of the API docs because its routes are defined by whichever server
// plugins are installed
@ApiExcludeController()
@Validations(Role.ReadOnly)
@Controller('plugin-routes')
export class PluginRoutesController {
  private readonly logger = new Logger(PluginRoutesController.name)

  constructor(private readonly pluginsService: PluginsService) {}

  @All('*')
  async handle(@Req() req: Request, @Res() res: Response) {
    const subPath = req.path.slice(ROUTES_PREFIX.length)
    const route = this.pluginsService.pluginRoutes.find(
      (r) => r.method === req.method && r.path === subPath,
    )
    if (!route) {
      res.status(404).end()
      return
    }
    try {
      await route.handler(req, res)
    } catch (error) {
      this.logger.error(error)
      if (!res.headersSent) {
        res.status(500).end()
      }
    }
  }
}
