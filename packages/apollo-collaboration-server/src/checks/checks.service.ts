import { Injectable, Logger } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { AnnotationFeatureSnapshot, CheckResultSnapshot } from 'apollo-mst'
import {
  CheckResult,
  CheckResultDocument,
  FeatureDocument,
} from 'apollo-schemas'
import { CDSCheck } from 'apollo-shared'
import { Model } from 'mongoose'

import { FeatureRangeSearchDto } from '../entity/gff3Object.dto'
import { OperationsService } from '../operations/operations.service'

@Injectable()
export class ChecksService {
  constructor(
    private readonly operationsService: OperationsService,
    @InjectModel(CheckResult.name)
    private readonly checkResultModel: Model<CheckResultDocument>,
  ) {}

  private readonly logger = new Logger(ChecksService.name)

  async checkFeature(
    doc: FeatureDocument,
    getSequence: (start: number, end: number) => Promise<string>,
  ): Promise<CheckResultSnapshot[]> {
    const flatDoc: AnnotationFeatureSnapshot = doc.toObject({
      flattenMaps: true,
    })
    const check = new CDSCheck()
    return check.checkFeature(flatDoc, getSequence)
  }

  /**
   * Get all possible checkResults for given featureId
   * @param id - featureId
   * @returns - an array of checkResult -documents
   */
  async findByFeatureId(id: string) {
    return this.checkResultModel.find({ ids: id }).exec()
  }

  /**
   * Get all possible checkResults for given range (refSeq, start, end)
   * @param searchDto - range
   * @returns an array of checkResult-documents
   */
  async findByRange(searchDto: FeatureRangeSearchDto) {
    return this.checkResultModel
      .find({
        refSeq: searchDto.refSeq,
        start: { $lte: searchDto.end },
        end: { $gte: searchDto.start },
        status: 0,
      })
      .exec()
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
