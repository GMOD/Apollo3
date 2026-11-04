import type { PluginRouteContext } from '@apollo-annotation/common/server'
import { All, Controller, Logger, Req, Res } from '@nestjs/common'
import { InjectConnection } from '@nestjs/mongoose'
import type { Request, Response } from 'express'
import type { Connection } from 'mongoose'

import { AssemblyAccessService } from '../assemblyAccess/assemblyAccess.service.js'
import { getRequestUser } from '../utils/requestWithUser.js'
import { Role, RoleInheritance } from '../utils/role/role.enum.js'
import { Validations } from '../utils/validation/validatation.decorator.js'

import { PluginsService } from './plugins.service.js'

const ROUTES_PREFIX = '/plugin-routes'

/**
 * Serves the routes plugins register with `Apollo-RegisterRoutes`. Each route
 * sets its own minimum role, so the controller itself allows any role and
 * checks the route's role once the route is found.
 */
@Validations(Role.None)
@Controller('plugin-routes')
export class PluginRoutesController {
  private readonly logger = new Logger(PluginRoutesController.name)

  constructor(
    private readonly pluginsService: PluginsService,
    private readonly assemblyAccessService: AssemblyAccessService,
    @InjectConnection() private readonly connection: Connection,
  ) {}

  @All('{*path}')
  async handle(@Req() req: Request, @Res() res: Response) {
    const subPath = req.path.slice(ROUTES_PREFIX.length) || '/'
    const found = this.pluginsService.findRoute(req.method, subPath)
    if (!found) {
      res.status(404).end()
      return
    }
    const { params, route } = found

    const user = getRequestUser(req)
    const requiredRole = route.role ?? Role.ReadOnly
    const role = user?.role ?? Role.None
    if (!RoleInheritance[role].includes(requiredRole as Role)) {
      res.status(403).end()
      return
    }

    try {
      const context: PluginRouteContext = {
        params,
        user:
          user?.id && user.email && user.username
            ? {
                id: user.id,
                username: user.username,
                email: user.email,
                role: user.role,
              }
            : undefined,
        allowedAssemblyIds:
          await this.assemblyAccessService.getAllowedAssemblyIds(user),
        connection: this.connection,
        logger: this.logger,
      }
      await route.handler(req, res, context)
    } catch (error) {
      this.logger.error(error)
      if (!res.headersSent) {
        res.status(500).end()
      }
    }
  }
}
