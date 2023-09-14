import { Injectable, Logger } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Feature, FeatureDocument } from 'apollo-schemas'
import { Model } from 'mongoose'

import { FeatureRangeSearchDto } from '../entity/gff3Object.dto'

@Injectable()
export class CheckReportsService {
  constructor(
    @InjectModel(Feature.name)
    private readonly featureModel: Model<FeatureDocument>,
  ) {}

  private readonly logger = new Logger(CheckReportsService.name)

  async checkFeatureRange(request: FeatureRangeSearchDto) {
    this.logger.debug(
      `getFeaturesByCriteria -method: refSeq: ${request.refSeq}, start: ${request.start}, end: ${request.end}`,
    )

    const features: FeatureDocument[] = await this.featureModel
      .find({
        $and: [
          { refSeq: request.refSeq },
          { start: { $gte: request.start } },
          { end: { $lte: request.end } },
        ],
      })
      .exec()
    return features
  }
}
