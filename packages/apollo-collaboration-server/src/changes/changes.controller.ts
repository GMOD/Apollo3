import {
  Body,
  Controller,
  Get,
  Logger,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common'
import { SerializedChange } from 'apollo-shared'

import { JwtAuthGuard } from '../utils/jwt-auth.guard'
import { Roles } from '../utils/role/role.decorator'
import { Role } from '../utils/role/role.enum'
import { ChangesService } from './changes.service'
import { FindChangeDto } from './dto/find-change.dto'

@UseGuards(JwtAuthGuard)
@Roles(Role.ReadOnly)
@Controller('changes')
export class ChangesController {
  constructor(private readonly changesService: ChangesService) {}
  private readonly logger = new Logger(ChangesController.name)

  /**
   * Updates end position of given feature. Before update, current end -position value is checked (against given old-value)
   * @param serializedChange - Information containing featureId, newEndValue, oldEndValue
   * @returns Return 'HttpStatus.OK' if featureId was found AND oldEndValue matched AND database update was successfull. Otherwise throw exception.
   */
  @Post()
  @Roles(Role.User)
  async create(@Body() serializedChange: SerializedChange) {
    this.logger.debug(
      `Requested type: ${
        serializedChange.typeName
      }, the whole change: ${JSON.stringify(serializedChange)}`,
    )
    return this.changesService.create(serializedChange)
  }

  @Get()
  async findAll(@Query() changeFilter: FindChangeDto) {
    this.logger.debug(`ChangeFilter: ${JSON.stringify(changeFilter)}`)
    return this.changesService.findAll(changeFilter)
  }
}
