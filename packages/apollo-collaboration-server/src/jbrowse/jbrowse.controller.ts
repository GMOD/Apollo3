import { Controller, Get, Logger } from '@nestjs/common'

import { JBrowseService } from './jbrowse.service'
import { Role } from '../utils/role/role.enum'
import { Validations } from '../utils/validation/validatation.decorator'

@Validations(Role.None)
@Controller()
export class JBrowseController {
  constructor(private readonly jbrowseService: JBrowseService) {}
  private readonly logger = new Logger(JBrowseController.name)

  @Get('config.json')
  getLoginTypes() {
    return this.jbrowseService.getConfig()
  }
}
