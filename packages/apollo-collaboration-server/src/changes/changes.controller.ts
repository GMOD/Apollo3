import {
  Body,
  Controller,
  Get,
  Logger,
  Post,
  Query,
  Req,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common'
import { Change } from 'apollo-shared'
import { Request } from 'express'

import { ChangeInterceptor } from '../utils/change.interceptor'
import { getDecodedAccessToken } from '../utils/commonUtilities'
import { JwtAuthGuard } from '../utils/jwt-auth.guard'
import { Role } from '../utils/role/role.enum'
import { Validations } from '../utils/validation/validatation.decorator'
import { ChangesService } from './changes.service'
import { FindChangeDto } from './dto/find-change.dto'

@UseGuards(JwtAuthGuard)
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
  @UseInterceptors(ChangeInterceptor)
  @Validations(Role.User)
  async create(@Body() change: Change, @Req() req: Request) {
    // Add user's email to Change -object if it's not filled yet
    if (!change.user) {
      const { authorization } = req.headers
      if (!authorization) {
        throw new Error('No "authorization" header')
      }
      const [, token] = authorization.split(' ')
      const jwtPayload = getDecodedAccessToken(token)
      const { email } = jwtPayload
      change.user = email
    }
    this.logger.debug(
      `Change type is '${change.typeName}', change object: ${JSON.stringify(
        change,
      )}`,
    )
    return this.changesService.create(change)
  }

  @Get()
  async findAll(@Query() changeFilter: FindChangeDto) {
    this.logger.debug(`ChangeFilter: ${JSON.stringify(changeFilter)}`)
    return this.changesService.findAll(changeFilter)
  }
}
