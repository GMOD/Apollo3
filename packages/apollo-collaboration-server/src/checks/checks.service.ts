import { Injectable, Logger } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { CheckResultSnapshot } from 'apollo-mst'
import {
  CheckReport,
  CheckReportDocument,
  FeatureDocument,
} from 'apollo-schemas'
import { GetFeaturesOperation } from 'apollo-shared'
import { Model } from 'mongoose'

import { FeatureRangeSearchDto } from '../entity/gff3Object.dto'
import { OperationsService } from '../operations/operations.service'

@Injectable()
export class ChecksService {
  constructor(
    private readonly operationsService: OperationsService,
    @InjectModel(CheckReport.name)
    private readonly checkReportModel: Model<CheckReportDocument>,
  ) {}

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

  /**
   * Get all possible checkReports for given featureId
   * @param id - featureId
   * @returns - an array of checkReport -documents
   */
  async findByFeatureId(id: string) {
    const checkReports = await this.checkReportModel.find({ ids: id }).exec()
    return checkReports
  }

  /**
   * Get all possible checkReports for given range (refSeq, start, end)
   * @param searchDto - range
   * @returns an array of checkReport -documents
   */
  async findByRange(searchDto: FeatureRangeSearchDto) {
    const featureDocs =
      await this.operationsService.executeOperation<GetFeaturesOperation>({
        typeName: 'GetFeaturesOperation',
        refSeq: searchDto.refSeq,
        start: searchDto.start,
        end: searchDto.end,
      })
    const allIdsArray: string[] = featureDocs.flatMap((doc) => doc.allIds)
    const checkReports = await this.checkReportModel
      .find({ ids: { $in: allIdsArray } })
      .exec()
    return checkReports
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
