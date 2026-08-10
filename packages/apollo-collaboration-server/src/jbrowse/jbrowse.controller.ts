import { Controller, Get, Logger, Req } from '@nestjs/common'

import { AssemblyAccessService } from '../assemblyAccess/assemblyAccess.service.js'
import type { RequestWithUser } from '../utils/requestWithUser.js'
import { Role } from '../utils/role/role.enum.js'
import { Validations } from '../utils/validation/validatation.decorator.js'

import { JBrowseService } from './jbrowse.service.js'

@Controller('jbrowse')
export class JBrowseController {
  constructor(
    private readonly jbrowseService: JBrowseService,
    private readonly assemblyAccessService: AssemblyAccessService,
  ) {}
  private readonly logger = new Logger(JBrowseController.name)

  @Validations(Role.None)
  @Get('config.json')
  async config(@Req() request: RequestWithUser) {
    const { user } = request
    if (!user) {
      throw new Error('No user for request')
    }
    const { id, role } = user
    const allowedAssemblyIds =
      await this.assemblyAccessService.getAllowedAssemblyIds(user)
    return this.jbrowseService.getConfig(
      id ? (role as Role | undefined) : undefined,
      allowedAssemblyIds,
    )
  }
}
