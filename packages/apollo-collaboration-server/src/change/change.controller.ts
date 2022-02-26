import { open } from 'fs/promises'
import { join } from 'path'

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

  @UseGuards(JwtAuthGuard)
  @Post('/submitChange')
  async submitChange(@Body() serializedChange: SerializedChange) {
    // Get environment variable values and pass those as parameter to apply -method
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
    const gff3Handle = await open(
      join(FILE_SEARCH_FOLDER, GFF3_DEFAULT_FILENAME_TO_SAVE),
      'w',
    )
    await change.apply({
      typeName: 'LocalGFF3',
      cacheManager: this.cacheManager,
      gff3Handle,
    })
    gff3Handle.close()
    return []
  }
}
