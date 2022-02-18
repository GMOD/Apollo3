import {
  Body,
  CACHE_MANAGER,
  Controller,
  Get,
  Inject,
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
import { Cache } from 'cache-manager'
import { Request } from 'express'

import { LocalGFF3DataStore } from '../../../apollo-shared'
import { JwtAuthGuard } from '../utils/jwt-auth.guard'
import { ChangeService } from './change.service'

@Controller('change')
export class ChangeController {
  private readonly logger = new Logger(ChangeController.name)
  constructor(
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private readonly changeService: ChangeService,
  ) {
    changeRegistry.registerChange('LocationEndChange', LocationEndChange) // Do this only once
  }

  //   @UseGuards(JwtAuthGuard)
  @Post('/submitchange')
  async submitChange(@Body() serializedChange: SerializedChange) {
    // const nberOfEntries = await this.cacheManager.store.keys?.()
    // // // Loop cache
    // // for (const keyInd of nberOfEntries) {
    // //   this.logger.debug(`ARVO is ${value1}`)
    // //   cacheValue = await this.cacheManager.get(keyInd)
    // // }

    // const value1 = await this.cacheManager.get('0')
    // this.logger.debug(`ARVO is ${value1}`)
    // this.logger.debug(`Cache size is ${nberOfEntries}`)
    const change = LocationEndChange.fromJSON(serializedChange)
    this.logger.debug(`change=${JSON.stringify(change)}`)
    const param1: LocalGFF3DataStore = {
      typeName: 'LocalGFF3',
      serializedChange: serializedChange,
      cacheManager: this.cacheManager,
    }
    this.logger.debug('Start calling change.applyToLocalGFF3...')
    await change.applyToLocalGFF3(param1)
    this.logger.debug('Returned from change.applyToLocalGFF3')
    return 'ok' // this.changeService.changeLocationEnd(param1, change)
  }
}
