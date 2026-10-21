/* eslint-disable @typescript-eslint/no-unnecessary-condition */
import { Change } from '@apollo-annotation/common'
import type { DecodedJWT } from '@apollo-annotation/shared'
import { Body, Controller, Get, Logger, Post, Query, Req } from '@nestjs/common'
import type { Request } from 'express'

import { AssemblyAccess } from '../assemblyAccess/assemblyAccess.decorator.js'
import { AssemblyAccessService } from '../assemblyAccess/assemblyAccess.service.js'
import { ParseChangePipe } from '../utils/parse-change.pipe.js'
import type { RequestWithUser } from '../utils/requestWithUser.js'
import { Role } from '../utils/role/role.enum.js'
import { Validations } from '../utils/validation/validatation.decorator.js'

import { ChangesService } from './changes.service.js'
import { FindChangeDto } from './dto/find-change.dto.js'

@Validations(Role.ReadOnly)
@Controller('changes')
export class ChangesController {
  constructor(
    private readonly changesService: ChangesService,
    private readonly assemblyAccessService: AssemblyAccessService,
  ) {}
  private readonly logger = new Logger(ChangesController.name)

  /**
   * ...
   * @param serializedChange - Information containing ...
   * @returns Return 'HttpStatus.OK' if .... Otherwise throw exception.
   */
  @AssemblyAccess({ kind: 'change' })
  @Post()
  @Validations(Role.User)
  async create(@Body(ParseChangePipe) change: Change, @Req() request: Request) {
    const { user } = request as unknown as { user: DecodedJWT }
    if (!user) {
      throw new Error('No user attached to request')
    }
    this.logger.debug(
      `Change type is '${change.typeName}', change object: ${JSON.stringify(
        change,
      )}`,
    )
    return this.changesService.create(change, user)
  }

  @AssemblyAccess({
    kind: 'assembly',
    in: 'query',
    key: 'assembly',
    optional: true,
  })
  @Get()
  async findAll(
    @Query() changeFilter: FindChangeDto,
    @Req() request: RequestWithUser,
  ) {
    this.logger.debug(`ChangeFilter: ${JSON.stringify(changeFilter)}`)
    const allowedAssemblyIds =
      await this.assemblyAccessService.getAllowedAssemblyIds(request.user)
    return this.changesService.findAll(changeFilter, allowedAssemblyIds)
  }
}
