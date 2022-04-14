import { open } from 'fs/promises'
import { join } from 'path'

import { Logger } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Feature, FeatureDocument } from 'apollo-schemas'
import {
  LocationEndChange,
  LocationStartChange,
  SerializedChange,
  changeRegistry,
} from 'apollo-shared'
import { Model } from 'mongoose'

export class ChangeService {
  constructor(
    @InjectModel(Feature.name)
    private readonly featureModel: Model<FeatureDocument>,
  ) {
    changeRegistry.registerChange('LocationEndChange', LocationEndChange) // Do this only once
    changeRegistry.registerChange('LocationStartChange', LocationStartChange) // Do this only once
  }

  private readonly logger = new Logger(ChangeService.name)

  async submitChange(serializedChange: SerializedChange) {
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
    //   await change.apply({
    //     typeName: 'LocalGFF3',
    //     cacheManager: this.cacheManager,
    //     gff3Handle,
    //   })
      // await change.apply({
      //   typeName: 'Server',
      //   featureModel: this.featureModel,
      // })
    } catch (error) {
      throw error
    } finally {
      gff3Handle.close()
    }
    try {
    //   await change.apply({
    //     typeName: 'Server',
    //     featureModel: this.featureModel,
    //   })
    } catch (error) {
      this.logger.error(
        'Failed to apply change to DB, but ignoring for now until DB is finalized',
      )
      this.logger.error(error)
    }
    // const results2 = await this.validations.backendPostValidate(change)
    return []
  }
}
