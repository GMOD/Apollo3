import {
  Body,
  Controller,
  Get,
  Logger,
  Post,
  Query,
  UseInterceptors,
} from '@nestjs/common'
import { Change } from 'apollo-shared'

import { ChangeInterceptor } from '../utils/change.interceptor'
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
}
