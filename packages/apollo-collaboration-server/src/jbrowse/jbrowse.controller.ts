import { Controller, Get, Logger, Req } from '@nestjs/common'
import { Request } from 'express'

import { Role } from '../utils/role/role.enum'
import { Validations } from '../utils/validation/validatation.decorator'

import { JBrowseService } from './jbrowse.service'

export interface RequestWithUser extends Request {
  user?: { role: Role; id?: string }
}

@Controller('jbrowse')
export class JBrowseController {
  constructor(private readonly jbrowseService: JBrowseService) {}
  private readonly logger = new Logger(JBrowseController.name)

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
