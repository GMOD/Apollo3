import {
  Body,
  Controller,
  Logger,
  Post,
  UseGuards,
} from '@nestjs/common'
import { SerializedChange } from 'apollo-shared'

import { JwtAuthGuard } from '../utils/jwt-auth.guard'
import { ChangeService } from './change.service'

@Controller('change')
export class ChangeController {
  private readonly logger = new Logger(ChangeController.name)
  constructor(private readonly changeService: ChangeService) {}

  // @UseGuards(JwtAuthGuard)
  @Post('/submitChange')
  async submitChange(@Body() serializedChange: SerializedChange) {
    this.changeService.changeEndPos(serializedChange)
  }
}
