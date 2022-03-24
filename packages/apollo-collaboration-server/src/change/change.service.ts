import { Injectable, Logger } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import {
  Feature,
  FeatureDocument,
  LocationEndChange,
  LocationStartChange,
  SerializedChange,
  changeRegistry,
} from 'apollo-shared'
import { Model } from 'mongoose'

@Injectable()
export class ChangeService {
  constructor(
    @InjectModel(Feature.name)
    private readonly featureModel: Model<FeatureDocument>,
  ) {
    changeRegistry.registerChange('LocationEndChange', LocationEndChange) // Do this only once
    changeRegistry.registerChange('LocationStartChange', LocationStartChange) // Do this only once
  }

  private readonly logger = new Logger(ChangeService.name)

  /**
   * Changes Start -position in GFF3
   */
  async changeStartPos(serializedChange: SerializedChange) {
    const ChangeType = changeRegistry.getChangeType(serializedChange.typeName)
    const change = new ChangeType(serializedChange)
    this.logger.debug(`Requested change: ${JSON.stringify(change)}`)
    try {
      await change.apply({
        typeName: 'LocalGFF3',
        featureModel: this.featureModel,
      })
    } catch (error) {
      throw error
    }
    return []
  }

  /**
   * Changes End -position in GFF3
   */
  async changeEndPos(serializedChange: SerializedChange) {
    const ChangeType = changeRegistry.getChangeType(serializedChange.typeName)
    const change = new ChangeType(serializedChange)
    this.logger.debug(`Requested change: ${JSON.stringify(change)}`)
    try {
      await change.apply({
        typeName: 'LocalGFF3',
        featureModel: this.featureModel,
      })
    } catch (error) {
      throw error
    }
    return []
  }
}
