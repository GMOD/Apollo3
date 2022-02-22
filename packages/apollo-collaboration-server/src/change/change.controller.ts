import {
  Body,
  CACHE_MANAGER,
  Controller,
  Inject,
  Logger,
  Post,
  UseGuards,
} from '@nestjs/common'
import {
  LocationEndChange,
  SerializedChange,
  changeRegistry,
} from 'apollo-shared'
import { Cache } from 'cache-manager'

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
    // Get environment variable values and pass those as parameter to applyToLocalGFF3 -method
    const { FILE_SEARCH_FOLDER, GFF3_DEFAULT_FILENAME_TO_SAVE } = process.env
    if (!FILE_SEARCH_FOLDER) {
      throw new Error('No FILE_SEARCH_FOLDER found in .env file')
    }
    if (!GFF3_DEFAULT_FILENAME_TO_SAVE) {
      throw new Error('No GFF3_DEFAULT_FILENAME_TO_SAVE found in .env file')
    }
    const envMap = new Map<string, string>()
    envMap.set('FILE_SEARCH_FOLDER', FILE_SEARCH_FOLDER)
    envMap.set('GFF3_DEFAULT_FILENAME_TO_SAVE', GFF3_DEFAULT_FILENAME_TO_SAVE)

    const change = LocationEndChange.fromJSON(serializedChange)
    this.logger.debug(`Requested change=${JSON.stringify(change)}`)
    const param1: LocalGFF3DataStore = {
      typeName: 'LocalGFF3',
      serializedChange: serializedChange,
      cacheManager: this.cacheManager,
      envMap: envMap,
    }
    this.logger.debug('Start calling change.applyToLocalGFF3...')
    await change.applyToLocalGFF3(param1)
    this.logger.debug('Returned from change.applyToLocalGFF3')
    return 'ok' // this.changeService.changeLocationEnd(param1, change)
  }
}
