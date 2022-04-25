import { open } from 'fs/promises'
import { join } from 'path'

import {
  CACHE_MANAGER,
  Inject,
  Logger,
  UnprocessableEntityException,
} from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Feature, FeatureDocument } from 'apollo-schemas'
import {
  CoreValidation,
  LocationEndChange,
  LocationStartChange,
  SerializedChange,
  ValidationSet,
  changeRegistry,
} from 'apollo-shared'
import { Cache } from 'cache-manager'
import { Model } from 'mongoose'

export class ChangeService {
  constructor(
    @InjectModel(Feature.name)
    private readonly featureModel: Model<FeatureDocument>,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {
    changeRegistry.registerChange('LocationEndChange', LocationEndChange) // Do this only once
    changeRegistry.registerChange('LocationStartChange', LocationStartChange) // Do this only once
  }

  private readonly logger = new Logger(ChangeService.name)
  private readonly validations = new ValidationSet([new CoreValidation()])

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
    const validationResult = await this.validations.backendPreValidate(change)
    if (!validationResult.ok) {
      const errorMessage = validationResult.results
        .map((r) => r.error?.message)
        .filter(Boolean)
        .join(', ')
      throw new UnprocessableEntityException(
        `Error in backend pre-validation: ${errorMessage}`,
      )
    }
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
      // await change.apply({
      //   typeName: 'Server',
      //   featureModel: this.featureModel,
      // })
    } finally {
      gff3Handle.close()
    }
    await this.featureModel.db.transaction(async (session) => {
      await change.apply({
        typeName: 'Server',
        featureModel: this.featureModel,
        session,
      })
      const validationResult2 = await this.validations.backendPostValidate(
        change,
      )
      if (!validationResult2.ok) {
        const errorMessage = validationResult2.results
          .map((r) => r.error?.message)
          .filter(Boolean)
          .join(', ')
        throw new UnprocessableEntityException(
          `Error in backend post-validation: ${errorMessage}`,
        )
      }
    })
    return []
  }
}
