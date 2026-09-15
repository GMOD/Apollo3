import fs from 'node:fs/promises'
import path from 'node:path'

import { Controller, Get, NotFoundException, Req, Res } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { Request, Response as ExpressResponse } from 'express'

import { JBrowseService } from '../jbrowse/jbrowse.service.js'
import { resolveJBrowseDir } from '../utils/jbrowse-dir.util.js'
import { Role } from '../utils/role/role.enum.js'
import { Validations } from '../utils/validation/validatation.decorator.js'

import {
  getApiPrefixFromUrl,
  injectAuthRedirectScript,
} from './index-html.template.js'

interface IndexHtmlConfig {
  JBROWSE_DIR?: string
  JBROWSE_DEV_SERVER_URL?: string
  URL: string
}

interface RequestWithUser extends Request {
  user?: { role: Role; id?: string; iat?: number }
}

@Validations(Role.None)
@Controller()
export class IndexHtmlController {
  constructor(
    private readonly configService: ConfigService<IndexHtmlConfig, true>,
    private readonly jbrowseService: JBrowseService,
  ) {}

  @Get(['/', '/index.html'])
  async getIndex(
    @Req() request: RequestWithUser,
    @Res() response: ExpressResponse,
  ): Promise<void> {
    const apiPrefix = getApiPrefixFromUrl(
      this.configService.get('URL', { infer: true }),
    )
    if (!request.user?.id) {
      const redirectUri = encodeURIComponent(request.originalUrl)
      response.redirect(`${apiPrefix}login?redirect_uri=${redirectUri}`)
      return
    }
    const html = await this.readIndexHtml()
    response.type('html').send(injectAuthRedirectScript(html, { apiPrefix }))
  }

  /**
   * Reads the app shell's index.html either off disk (JBROWSE_DIR, the
   * default) or, in the dev-only mode where a JBrowse dev server is running
   * instead of a built bundle on disk, by fetching it from that dev server
   * (JBROWSE_DEV_SERVER_URL). These two are mutually exclusive, enforced by
   * the Joi `.xor` in app.module.ts.
   */
  private async readIndexHtml(): Promise<string> {
    const devServerUrl = this.configService.get('JBROWSE_DEV_SERVER_URL', {
      infer: true,
    })
    if (devServerUrl) {
      let response: Response
      try {
        response = await fetch(new URL('index.html', devServerUrl))
      } catch {
        throw new NotFoundException()
      }
      if (!response.ok) {
        throw new NotFoundException()
      }
      return response.text()
    }
    // Guaranteed to be set when JBROWSE_DEV_SERVER_URL isn't (enforced by
    // the Joi `.xor` in app.module.ts).
    const jbrowseDir = resolveJBrowseDir(
      this.configService.get('JBROWSE_DIR', { infer: true }),
    )
    try {
      return await fs.readFile(path.join(jbrowseDir, 'index.html'), 'utf8')
    } catch {
      throw new NotFoundException()
    }
  }

  /**
   * Alias for `jbrowse/config.json` at the site root. This is what a
   * reverse proxy in front of the collaboration server (e.g. the
   * `ProxyPass "/config.json" ".../jbrowse/config.json"` rule in the
   * deployment docs) forwards to; serving it here too lets the
   * collaboration server stand in for that proxy on its own.
   */
  @Get('/config.json')
  getConfigJson(@Req() request: RequestWithUser) {
    const { user } = request
    if (!user) {
      throw new Error('No user for request')
    }
    const { role, id, iat } = user
    return this.jbrowseService.getConfig(
      id ? { id, iat: iat ?? 0, role } : undefined,
    )
  }
}
