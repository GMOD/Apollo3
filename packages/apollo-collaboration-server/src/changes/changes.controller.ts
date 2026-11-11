/* eslint-disable @typescript-eslint/no-unnecessary-condition */
import { Change } from '@apollo-annotation/common'
import type { DecodedJWT } from '@apollo-annotation/shared'
import { Body, Controller, Get, Logger, Post, Query, Req } from '@nestjs/common'
import { ApiBody } from '@nestjs/swagger'
import type { Request } from 'express'

import { ParseChangePipe } from '../utils/parse-change.pipe.js'
import { Role } from '../utils/role/role.enum.js'
import { Validations } from '../utils/validation/validatation.decorator.js'

import { ChangesService } from './changes.service.js'
import { FindChangeDto } from './dto/find-change.dto.js'
import { SubmitChangeDto } from './dto/submit-change.dto.js'

@Validations(Role.ReadOnly)
@Controller('changes')
export class ChangesController {
  constructor(private readonly changesService: ChangesService) {}
  private readonly logger = new Logger(ChangesController.name)

  /**
   * Submit a change
   *
   * All edits to annotations, assemblies, and users are made by submitting
   * changes. The server validates and applies the change, saves it to the
   * change log, and broadcasts it to other connected clients.
   */
  @ApiBody({ type: SubmitChangeDto })
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

  /**
   * List changes from the change log
   *
   * Returns `{ changes, totalCount }`, where `totalCount` is the number of
   * changes that match the filters, ignoring paging.
   */
  @Get()
  async findAll(@Query() changeFilter: FindChangeDto) {
    this.logger.debug(`ChangeFilter: ${JSON.stringify(changeFilter)}`)
    return this.changesService.findAll(changeFilter)
  }
}
