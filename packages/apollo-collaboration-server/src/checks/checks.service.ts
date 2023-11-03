import { Injectable, Logger } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { AnnotationFeatureSnapshot, CheckResultSnapshot } from 'apollo-mst'
import {
  CheckResult,
  CheckResultDocument,
  FeatureDocument,
} from 'apollo-schemas'
import { Model } from 'mongoose'

import { FeatureRangeSearchDto } from '../entity/gff3Object.dto'
import { OperationsService } from '../operations/operations.service'
import { Check } from 'apollo-shared'

class FakeCheck extends Check {
  async checkFeature(
    feature: AnnotationFeatureSnapshot,
  ): Promise<CheckResultSnapshot> {
    const { _id, end, refSeq, start } = feature
    const id = _id.toString()
    return {
      _id: `${id}-fake`,
      name: 'FakeInMemoryCheckResult',
      ids: [id],
      refSeq: refSeq.toString(),
      start,
      end,
      message: `This is a fake result for feature ${id}`,
    }
  }
}

@Injectable()
export class ChecksService {
  constructor(
    private readonly operationsService: OperationsService,
    @InjectModel(CheckResult.name)
    private readonly checkResultModel: Model<CheckResultDocument>,
  ) {}

  private readonly logger = new Logger(ChecksService.name)

  async checkFeature(doc: FeatureDocument): Promise<CheckResultSnapshot> {
    const annotationFeatureSnapshot: AnnotationFeatureSnapshot = {
      _id: doc.id,
      gffId: doc.gffId,
      refSeq: doc.refSeq.toString(),
      type: doc.type,
      start: doc.start,
      end: doc.end,
    }
    const check: FakeCheck = new FakeCheck()
    return check.checkFeature(annotationFeatureSnapshot)
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
