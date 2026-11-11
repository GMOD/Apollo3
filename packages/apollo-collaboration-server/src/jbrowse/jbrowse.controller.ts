import { Controller, Get, Req } from '@nestjs/common'
import type { Request } from 'express'

import { Role } from '../utils/role/role.enum.js'
import { Validations } from '../utils/validation/validatation.decorator.js'

import { JBrowseService } from './jbrowse.service.js'

export interface RequestWithUser extends Request {
  user?: { role: Role; id?: string }
}

@Controller('jbrowse')
export class JBrowseController {
  constructor(private readonly jbrowseService: JBrowseService) {}
  /**
   * Get JBrowse configuration for this server
   *
   * Includes the theme and Apollo plugin settings. If the request has a token
   * for a user with a role, it also includes the location of the feature type
   * ontology.
   */
  @Validations(Role.None)
  @Get('config.json')
  config(@Req() request: RequestWithUser) {
    const { user } = request
    if (!user) {
      throw new Error('No user for request')
    }
    const { role, id } = user
    return this.jbrowseService.getConfig(id ? role : undefined)
  }
}
