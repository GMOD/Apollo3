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

  // Right now this is just for demo/test purpose
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
          { status: 0 },
        ],
      })
      .exec()
    return features
  }
}
