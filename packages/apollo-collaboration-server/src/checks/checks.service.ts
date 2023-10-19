import { Injectable, Logger } from '@nestjs/common'
import { Feature, FeatureDocument, RefSeq } from 'apollo-schemas'
import { Model } from 'mongoose'

@Injectable()
export class ChecksService {
  private readonly logger = new Logger(ChecksService.name)

  async checkFeature(doc: FeatureDocument) {
    const featureModel = doc.$model<Model<FeatureDocument>>(Feature.name)
    this.logger.debug(`Feature Model: ${featureModel}`)
    const features = await featureModel.find().exec()
    this.logger.log(features[0])
    const refSeqModel = doc.$model(RefSeq.name)
    this.logger.debug(`RefSeq Model: ${refSeqModel}`)
    const refSeqs = await refSeqModel.find().exec()
    this.logger.log(refSeqs[0])
  }
}
