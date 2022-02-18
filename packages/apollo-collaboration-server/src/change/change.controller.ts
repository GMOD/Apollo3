import {
  Body,
  Controller,
  Get,
  Logger,
  Param,
  Post,
  Req,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common'
import {
  Change,
  LocationEndChange,
  SerializedChange,
  changeRegistry,
} from 'apollo-shared'
import { Request } from 'express'
import { LocalGFF3DataStore } from '../../../apollo-shared'

import { ChangeObjectTmp } from '../entity/gff3Object.dto'
import { JwtAuthGuard } from '../utils/jwt-auth.guard'
import { ChangeService } from './change.service'

@Controller('change')
export class ChangeController {
  private readonly logger = new Logger(ChangeController.name)
  constructor(private readonly changeService: ChangeService) {
    changeRegistry.registerChange('LocationEndChange', LocationEndChange) // Do this only once
  }

  //   @UseGuards(JwtAuthGuard)
  @Post('/submitchange')
  submitChange(@Body() serializedChange: SerializedChange) {
    // const change = LocationEndChange.fromJSON(serializedChange)
    // this.logger.debug(`change=${JSON.stringify(change)}`)


        const change = LocationEndChange.fromJSON(serializedChange)
    const param1: LocalGFF3DataStore = {
      typeName: 'LocalGFF3'
      // serializedChange: serializedChange,
      // cacheManager: this.cacheManager
    }
    this.logger.debug('Kutsu alkaa')
    return this.changeService.changeLocationEnd(param1, change)
  }
}
