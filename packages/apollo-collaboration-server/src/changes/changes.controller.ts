import {
  Body,
  Controller,
  Get,
  Logger,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common'
import { SerializedChange } from 'apollo-shared'

import { JwtAuthGuard } from '../utils/jwt-auth.guard'
import { ChangesService } from './changes.service'
import { FindChangeDto } from './dto/find-change.dto'

@Controller('changes')
export class ChangesController {
  constructor(private readonly changesService: ChangesService) {}
  private readonly logger = new Logger(ChangesController.name)

  /**
   * Updates end position of given feature. Before update, current end -position value is checked (against given old-value)
   * @param serializedChange - Information containing featureId, newEndValue, oldEndValue
   * @returns Return 'HttpStatus.OK' if featureId was found AND oldEndValue matched AND database update was successfull. Otherwise throw exception.
   */
  @UseGuards(JwtAuthGuard)
  @Post()
  async create(@Req() req: any, @Body() serializedChange: SerializedChange) {
    this.logger.debug(`Change done by '${req.user.username}'`)
    this.logger.debug(
      `Requested type: ${
        serializedChange.typeName
      }, the whole change: ${JSON.stringify(serializedChange)}`,
    )
    return this.changesService.create(serializedChange, req.user.username)
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  async findAll(@Query() changeFilter: FindChangeDto) {
    this.logger.debug(`ChangeFilter: ${JSON.stringify(changeFilter)}`)
    return this.changesService.findAll(changeFilter)
  }
}
