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
  LocationStartChange,
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
    changeRegistry.registerChange('LocationStartChange', LocationStartChange) // Do this only once
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

    const ChangeType = changeRegistry.getChangeType(serializedChange.typeName)
    const change = new ChangeType(serializedChange)
    this.logger.debug(`Requested change=${JSON.stringify(change)}`)
    // TODO: validate change
    // const result = await this.validations.backendPreValidate(change)
    const gff3Handle = await open(
      join(FILE_SEARCH_FOLDER, GFF3_DEFAULT_FILENAME_TO_SAVE),
      'r+',
    )
    try {
      await change.apply({
        typeName: 'LocalGFF3',
        cacheManager: this.cacheManager,
        gff3Handle,
      })
    } catch (error) {
      throw error
    } finally {
      gff3Handle.close()
    }
    // const results2 = await this.validations.backendPostValidate(change)
    return []
  }
}
