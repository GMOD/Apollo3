import { open } from 'fs/promises'
import { join } from 'path'

import { CACHE_MANAGER, Inject, Logger } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import {
  ChangeLog,
  ChangeLogDocument,
  Feature,
  FeatureDocument,
} from 'apollo-schemas'
import {
  LocationEndChange,
  LocationStartChange,
  SerializedChange,
  changeRegistry,
} from 'apollo-shared'
import { Cache } from 'cache-manager'
import { Model } from 'mongoose'

import { ChangeObjectTmp } from '../entity/gff3Object.dto'
import { ChangeLogDto } from './dto/create-change.dto'

export class ChangeService {
  constructor(
    @InjectModel(Feature.name)
    private readonly featureModel: Model<FeatureDocument>,
    @InjectModel(ChangeLog.name)
    private readonly changeLogModel: Model<ChangeLogDocument>,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {
    changeRegistry.registerChange('LocationEndChange', LocationEndChange) // Do this only once
    changeRegistry.registerChange('LocationStartChange', LocationStartChange) // Do this only once
  }

  private readonly logger = new Logger(ChangeService.name)

  async submitChange(serializedChange: SerializedChange): Promise<string> {
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
    this.logger.debug(`Requested change: ${JSON.stringify(change)}`)
    const { changedIds, assemblyId } = change.toJSON()

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
      // await change.apply({
      //   typeName: 'Server',
      //   featureModel: this.featureModel,
      // })
    } finally {
      gff3Handle.close()
    }

    let changeLogDocId = ''
    await this.featureModel.db.transaction(async (session) => {
      await change.apply({
        typeName: 'Server',
        featureModel: this.featureModel,
        session,
      })
      // Add change information to changeLog -collection
      const allFeatures: string[] = []
      const changes: ChangeObjectTmp = JSON.parse(JSON.stringify(change))
      this.logger.debug(`ChangeIds: ${changedIds}`)
      this.logger.debug(`AssemblyId: ${assemblyId}`)

      for (const oneChange of changes.changes) {
        allFeatures.push(oneChange.featureId)
      }
      // Add entry to changelog
      const changeLogEntry: ChangeLogDto = {
        assembly: assemblyId,
        changeId: changedIds[0],
        features: allFeatures,
        change: JSON.stringify(change),
        user: 'demo user id',
      }
      const savedChangedLogDoc = await this.changeLogModel.create(
        changeLogEntry,
      )
      changeLogDocId = savedChangedLogDoc._id
      // const results2 = await this.validations.backendPostValidate(change)
    })
    this.logger.debug(`ChangeLogDocId: ${changeLogDocId}`)
    return changeLogDocId
  }
}
