import {
  Controller,
  Get,
  Logger,
  Next,
  NotFoundException,
  Req,
  Res,
} from '@nestjs/common'
import type { NextFunction, Request, Response } from 'express'

import { Role } from '../utils/role/role.enum.js'
import { Validations } from '../utils/validation/validatation.decorator.js'

import { JBrowseConfigService } from './jbrowseConfig.service.js'
import { JBrowseService } from './jbrowse.service.js'

interface RequestWithUser extends Request {
  user?: { role: Role; id?: string; iat?: number }
}

/**
 * Serves the Apollo-augmented version of each JBrowse config.json declared
 * in JBROWSE_CONFIG_FILES (just "config.json" when that's unset) at that
 * file's own URL, so a client only ever needs JBrowse Web's own `config=`
 * param - e.g. "/?config=https://host/test_data/config.json" - with no
 * Apollo-specific query param.
 *
 * This has to be a wildcard route rather than one route per configured
 * file: Nest route paths are fixed at ES module import time, before
 * ConfigModule has parsed .env, so there's no way to know the configured
 * filenames yet when this class's decorators run. Every request that isn't
 * a configured config file is handed straight back to Express via `next()`,
 * so it reaches whatever would otherwise have served it - ServeStaticModule
 * (JBROWSE_DIR mode) or DevServerProxyController (JBROWSE_DEV_SERVER_URL
 * mode), both registered after this controller's module in
 * AppModule.imports.
 */
@Validations(Role.None)
@Controller()
export class ConfigFileController {
  private readonly logger = new Logger(ConfigFileController.name)

  constructor(
    private readonly jbrowseConfigService: JBrowseConfigService,
    private readonly jbrowseService: JBrowseService,
  ) {}

  @Get('*path')
  async getConfigFile(
    @Req() request: RequestWithUser,
    @Res() response: Response,
    @Next() next: NextFunction,
  ): Promise<void> {
    const fileName = this.jbrowseConfigService.matchConfigFileName(request.path)
    if (!fileName) {
      next()
      return
    }
    const { user } = request
    if (!user) {
      throw new Error('No user for request')
    }
    const { id, iat, role } = user
    let config: unknown
    try {
      config = await this.jbrowseService.getConfig(
        id ? { id, iat: iat ?? 0, role } : undefined,
        fileName,
      )
    } catch (error) {
      // Declared in JBROWSE_CONFIG_FILES but unreadable right now (e.g. a
      // dev server hiccup): a 404 is more honest to the client than a 500.
      this.logger.error(
        `Failed to read configured config file "${fileName}"`,
        error instanceof Error ? error.stack : error,
      )
      throw new NotFoundException(`Cannot GET ${request.path}`)
    }
    response.json(config)
  }
}
