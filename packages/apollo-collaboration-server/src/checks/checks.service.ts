import { Injectable, Logger } from '@nestjs/common'
import { CheckResultSnapshot } from 'apollo-mst'
import { FeatureDocument } from 'apollo-schemas'

@Injectable()
export class ChecksService {
  private readonly logger = new Logger(ChecksService.name)

  async checkFeature(doc: FeatureDocument): Promise<CheckResultSnapshot[]> {
    const { _id, end, refSeq, start } = doc
    const id = _id.toString()
    return [
      {
        _id: `${id}-fake`,
        name: 'FakeCheckResult',
        ids: [id],
        refSeq: refSeq.toString(),
        start,
        end,
        message: `This is a fake result for feature ${id}`,
      },
    ]
  }

  // async checkFeature(doc: FeatureDocument) {
  //   const featureModel = doc.$model<Model<FeatureDocument>>(Feature.name)
  //   this.logger.debug(`Feature Model: ${featureModel}`)
  //   const features = await featureModel.find().exec()
  //   this.logger.log(features[0])
  //   const refSeqModel = doc.$model(RefSeq.name)
  //   this.logger.debug(`RefSeq Model: ${refSeqModel}`)
  //   const refSeqs = await refSeqModel.find().exec()
  //   this.logger.log(refSeqs[0])
  // }
}
