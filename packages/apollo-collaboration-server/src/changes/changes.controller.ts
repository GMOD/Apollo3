import { Body, Controller, Get, Logger, Post, UseGuards } from '@nestjs/common'
import { ChangeFilter, SerializedChange } from 'apollo-shared'

import { JwtAuthGuard } from '../utils/jwt-auth.guard'
import { ChangesService } from './changes.service'

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
  async submitChange(@Body() serializedChange: SerializedChange) {
    this.logger.debug(
      `Requested type: ${
        serializedChange.typeName
      }, the whole change: ${JSON.stringify(serializedChange)}`,
    )
    return this.changesService.submitChange(serializedChange)
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  async getChange(@Query() changeFilter: ChangeFilter) {
    this.logger.debug(`ChangeFilter: ${JSON.stringify(changeFilter)}`)
    const chg = await this.changesService.findChange(changeFilter)
    return chg
  }

  @Get('/getChangeTypes')
  findChangeTypes() {
    return this.changesService.getChangeTypes()
  }
}
