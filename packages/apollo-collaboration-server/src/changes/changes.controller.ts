/* eslint-disable @typescript-eslint/no-unnecessary-condition */
import { Change } from '@apollo-annotation/apollo-common'
import { DecodedJWT } from '@apollo-annotation/apollo-shared'
import { Body, Controller, Get, Logger, Post, Query, Req } from '@nestjs/common'
import { Request } from 'express'

import { ParseChangePipe } from '../utils/parse-change.pipe'
import { Role } from '../utils/role/role.enum'
import { Validations } from '../utils/validation/validatation.decorator'
import { ChangesService } from './changes.service'
import { FindChangeDto } from './dto/find-change.dto'

@Validations(Role.ReadOnly)
@Controller('changes')
export class ChangesController {
  constructor(private readonly changesService: ChangesService) {}
  private readonly logger = new Logger(ChangesController.name)

  /**
   * ...
   * @param serializedChange - Information containing ...
   * @returns Return 'HttpStatus.OK' if .... Otherwise throw exception.
   */
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

  @Get()
  async findAll(@Query() changeFilter: FindChangeDto) {
    this.logger.debug(`ChangeFilter: ${JSON.stringify(changeFilter)}`)
    return this.changesService.findAll(changeFilter)
  }
}
