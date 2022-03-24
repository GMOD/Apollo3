import { Body, Controller, Logger, Post } from '@nestjs/common'
import { SerializedChange } from 'apollo-shared'

// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { JwtAuthGuard } from '../utils/jwt-auth.guard'
import { ChangeService } from './change.service'

@Controller('change')
export class ChangeController {
  private readonly logger = new Logger(ChangeController.name)
  constructor(private readonly changeService: ChangeService) {}

  // @UseGuards(JwtAuthGuard)
  @Post('/submitStartChange')
  async submitStartChange(@Body() serializedChange: SerializedChange) {
    this.changeService.changeStartPos(serializedChange)
  }

  // @UseGuards(JwtAuthGuard)
  @Post('/submitEndChange')
  async submitEndChange(@Body() serializedChange: SerializedChange) {
    this.changeService.changeEndPos(serializedChange)
  }
}
