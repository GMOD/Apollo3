import { Controller, Get, Logger, Req } from '@nestjs/common'
import { Request } from 'express'

import { JBrowseService } from './jbrowse.service'
import { Role } from '../utils/role/role.enum'
import { Validations } from '../utils/validation/validatation.decorator'

export interface RequestWithUser extends Request {
  user?: { role: Role }
}

@Validations(Role.None)
@Controller('jbrowse')
export class JBrowseController {
  constructor(private readonly jbrowseService: JBrowseService) {}
  private readonly logger = new Logger(JBrowseController.name)

  @Get('config.json')
  config(@Req() request: RequestWithUser) {
    const { user } = request
    if (!user) {
      throw new Error('No user for request')
    }
    return this.jbrowseService.getConfig(user.role)
  }
}
