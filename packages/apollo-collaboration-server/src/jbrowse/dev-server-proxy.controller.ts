import { All, Controller, Next, Req, Res } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { NextFunction, Request, Response } from 'express'
import {
  createProxyMiddleware,
  type RequestHandler,
} from 'http-proxy-middleware'

import { Role } from '../utils/role/role.enum.js'
import { Validations } from '../utils/validation/validatation.decorator.js'

interface DevServerProxyConfig {
  JBROWSE_DEV_SERVER_URL: string
}

/**
 * Catches every request that none of Apollo's own controllers claimed (the
 * JS/CSS bundles, source maps, etc. that IndexHtmlController and
 * ConfigFileController don't otherwise serve) and forwards it to a running
 * JBrowse dev server. Only registered when JBROWSE_DEV_SERVER_URL is set -
 * see app.module.ts's `ConditionalModule.registerWhen` - since it's
 * dev-only and mutually exclusive with JBROWSE_DIR/ServeStaticModule.
 *
 * This has to be a genuine Nest route (`@All`) rather than raw Express
 * middleware bolted on with `app.use()`: Nest's router terminates any
 * request that doesn't match one of its own routes with its own 404
 * response as soon as it's set up, so middleware registered afterward
 * never runs. Registering this controller's module last in AppModule's
 * `imports` ensures every other controller's more specific routes are
 * matched first, and this one only ever sees what's left over.
 */
@Validations(Role.None)
@Controller()
export class DevServerProxyController {
  private readonly proxy: RequestHandler

  constructor(configService: ConfigService<DevServerProxyConfig, true>) {
    const target = configService.get('JBROWSE_DEV_SERVER_URL', {
      infer: true,
    })
    this.proxy = createProxyMiddleware({ target, changeOrigin: true })
  }

  @All('*splat')
  proxyToDevServer(
    @Req() request: Request,
    @Res() response: Response,
    @Next() next: NextFunction,
  ) {
    this.proxy(request, response, next)
  }
}
