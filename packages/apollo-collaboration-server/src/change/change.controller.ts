import {
  Body,
  Controller,
  InternalServerErrorException,
  Logger,
  Post,
  UseGuards,
} from '@nestjs/common'
import { SerializedChange, changeRegistry } from 'apollo-shared'

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
  //  @UseGuards(JwtAuthGuard)
  @Post('/submitChange')
  async submitChange(@Body() serializedChange: SerializedChange) {
    const ChangeType = changeRegistry.getChangeType(serializedChange.typeName)
    const change = new ChangeType(serializedChange)
    this.logger.debug(
      `Requested type: ${change.typeName}, the whole change: ${JSON.stringify(
        change,
      )}`,
    )
    switch (change.typeName) {
      case 'LocationStartChange':
        return this.changeService.changeStartPos(serializedChange)
      case 'LocationEndChange':
        return this.changeService.changeEndPos(serializedChange)
      default:
        throw new InternalServerErrorException(
          `Unknown change request type "${change.typeName}"`,
        )
    }
  }
}
