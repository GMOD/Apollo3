import { Controller, Get } from '@nestjs/common'

import { Public } from '../utils/jwt-auth.guard'
import { JBrowseService } from './jbrowse.service'

@Public()
@Controller()
export class JBrowseController {
  constructor(private readonly jbrowseService: JBrowseService) {}

  @Get('config.json')
  getLoginTypes() {
    return this.jbrowseService.getConfig()
  }
}
