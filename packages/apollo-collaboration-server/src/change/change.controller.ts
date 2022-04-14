import { Body, Controller, Logger, Post, UseGuards } from '@nestjs/common'
import { SerializedChange } from 'apollo-shared'

import { JwtAuthGuard } from '../utils/jwt-auth.guard'
import { ChangeService } from './change.service'

@Controller('change')
export class ChangeController {
  constructor(private readonly changeService: ChangeService) {}
  private readonly logger = new Logger(ChangeController.name)

  /**
   * Updates end position of given feature. Before update, current end -position value is checked (against given old-value)
   * @param serializedChange - Information containing featureId, newEndValue, oldEndValue
   * @returns Return 'HttpStatus.OK' if featureId was found AND oldEndValue matched AND database update was successfull. Otherwise throw exception.
   */
  // @UseGuards(JwtAuthGuard)
  @Post('/submitChange')
  async submitChange(@Body() serializedChange: SerializedChange) {
    this.logger.debug(
      `Requested type: ${
        serializedChange.typeName
      }, the whole change: ${JSON.stringify(serializedChange)}`,
    )
    return this.changeService.submitChange(serializedChange)
  }
}
