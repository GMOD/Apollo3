import {
  Body,
  Controller,
  Get,
  Logger,
  Post,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common'
import { Change } from 'apollo-shared'

import { CountersService } from '../counters/counters.service'
import { ChangeInterceptor } from '../utils/change.interceptor'
import { JwtAuthGuard } from '../utils/jwt-auth.guard'
import { Role } from '../utils/role/role.enum'
import { Validations } from '../utils/validation/validatation.decorator'
import { ChangesService } from './changes.service'
import {
  FindChangeBySequenceDto,
  FindChangeDto,
  GetLastSequenceDto,
} from './dto/find-change.dto'

@UseGuards(JwtAuthGuard)
@Validations(Role.ReadOnly)
@Controller('changes')
export class ChangesController {
  constructor(
    private readonly changesService: ChangesService,
    private readonly countersService: CountersService,
  ) {}

  private readonly logger = new Logger(ChangesController.name)

  /**
   * ...
   * @param serializedChange - Information containing ...
   * @returns Return 'HttpStatus.OK' if .... Otherwise throw exception.
   */
  @Post()
  @UseInterceptors(ChangeInterceptor)
  @Validations(Role.User)
  async create(
    @Body()
    {
      change,
      user,
      userToken,
    }: {
      change: Change
      user: string
      userToken: string
    },
  ) {
    this.logger.debug(
      `Change type is '${change.typeName}', change object: ${JSON.stringify(
        change,
      )}`,
    )
    return this.changesService.create(change, user, userToken)
  }

  @Get()
  async findAll(@Query() changeFilter: FindChangeDto) {
    this.logger.debug(`ChangeFilter: ${JSON.stringify(changeFilter)}`)
    return this.changesService.findAll(changeFilter)
  }

  @Get('getLastChangesBySequence')
  async getLastChangesBySequence(
    @Query() changeFilter: FindChangeBySequenceDto,
  ) {
    this.logger.debug(
      `getLastChangesBySequence: ${JSON.stringify(changeFilter)}`,
    )
    this.changesService.reSendChanges(changeFilter)
    return { status: 'The last updates resent' }
  }

  @Get('getLastChangeSequence')
  async getLastChangeSequence(@Query() request: GetLastSequenceDto) {
    this.logger.debug(
      `Get current counter value for ${JSON.stringify(request.id)}`,
    )
    return this.countersService.getCurrentValue(request.id)
  }
}
