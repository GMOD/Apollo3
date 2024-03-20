import { Controller, Get, Logger } from '@nestjs/common'

import { Public } from '../utils/jwt-auth.guard'
import { JBrowseService } from './jbrowse.service'

@Public()
@Controller()
export class JBrowseController {
  constructor(private readonly jbrowseService: JBrowseService) {}
  private readonly logger = new Logger(JBrowseController.name)

  @Get('config.json')
  getLoginTypes() {
    return this.jbrowseService.getConfig()
  }

  @Get('getTracks')
  getAll() {
    return this.jbrowseService.findAllTracks()
  }
}
