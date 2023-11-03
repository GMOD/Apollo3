import { Injectable, Logger, NotFoundException } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import {
  Feature,
  FeatureDocument,
  RefSeq,
  RefSeqDocument,
} from 'apollo-schemas'
import { GetFeaturesOperation } from 'apollo-shared'
import { Model } from 'mongoose'

import { ChecksService } from '../checks/checks.service'
import { FeatureRangeSearchDto } from '../entity/gff3Object.dto'
import { OperationsService } from '../operations/operations.service'
import { FeatureCountRequest } from './dto/feature.dto'

@Injectable()
export class FeaturesService {
  constructor(
    private readonly operationsService: OperationsService,
    private readonly checksService: ChecksService,
    @InjectModel(Feature.name)
    private readonly featureModel: Model<FeatureDocument>,
    @InjectModel(RefSeq.name)
    private readonly refSeqModel: Model<RefSeqDocument>,
  ) {}

  private readonly logger = new Logger(FeaturesService.name)

  findAll() {
    return this.featureModel.find().exec()
  }

  async getFeatureCount(featureCountRequest: FeatureCountRequest) {
    let count = 0
    const { assemblyId, end, refSeqId, start } = featureCountRequest
    const filter: Record<
      string,
      number | string | { $lte: number } | { $gte: number }
    > = { status: 0 }

    if (end) {
      filter.start = { $lte: end }
    }
    if (start) {
      filter.end = { $gte: start }
    }

    if (refSeqId) {
      filter.refSeq = refSeqId
      count = await this.featureModel.countDocuments(filter)
    } else if (assemblyId) {
      const refSeqs: RefSeqDocument[] = await this.refSeqModel
        .find({ assembly: assemblyId })
        .exec()

      for (const refSeq of refSeqs) {
        filter.refSeq = refSeq._id
        count += await this.featureModel.countDocuments(filter)
      }
    } else {
      // returns count of all documents or in the range (start, end)
      count = await this.featureModel.countDocuments(filter)
    }

    this.logger.debug(`Number of features is ${count}`)
    return count
  }

  /**
   * Get feature by featureId. When retrieving features by id, the features and any of its children are returned, but not any of its parent or sibling features.
   * @param featureId - featureId
   * @returns Return the feature(s) if search was successful. Otherwise throw exception
   */
  async findById(featureId: string) {
    // Search correct feature
    const topLevelFeature = await this.featureModel
      .findOne({ allIds: featureId })
      .exec()

    if (!topLevelFeature) {
      const errMsg = `ERROR: The following featureId was not found in database ='${featureId}'`
      this.logger.error(errMsg)
      throw new NotFoundException(errMsg)
    }

    // Now we need to find correct top level feature or sub-feature inside the feature
    const foundFeature = this.getFeatureFromId(topLevelFeature, featureId)
    if (!foundFeature) {
      const errMsg = 'ERROR when searching feature by featureId'
      this.logger.error(errMsg)
      throw new NotFoundException(errMsg)
    }
    this.logger.debug(`Feature found: ${JSON.stringify(foundFeature)}`)
    return foundFeature
  }

  /**
   * Get single feature by featureId
   * @param featureOrDocument -
   * @param featureId -
   * @returns
   */
  getFeatureFromId(feature: Feature, featureId: string): Feature | null {
    this.logger.verbose(`Entry=${JSON.stringify(feature)}`)

    if (feature._id.equals(featureId)) {
      this.logger.debug(
        `Top level featureId matches in object ${JSON.stringify(feature)}`,
      )
      return feature
    }
    // Check if there is also childFeatures in parent feature and it's not empty
    // Let's get featureId from recursive method
    this.logger.debug(
      'FeatureId was not found on top level so lets make recursive call...',
    )
    for (const [, childFeature] of feature.children ?? new Map()) {
      const subFeature = this.getFeatureFromId(childFeature, featureId)
      if (subFeature) {
        return subFeature
      }
    }
    return null
  }

  async findByRange(searchDto: FeatureRangeSearchDto) {
    const featureDocs =
      await this.operationsService.executeOperation<GetFeaturesOperation>({
        typeName: 'GetFeaturesOperation',
        refSeq: searchDto.refSeq,
        start: searchDto.start,
        end: searchDto.end,
      })
    const checkResults = await Promise.all(
      featureDocs.map(async (featureDoc) =>
        this.checksService.checkFeature(featureDoc),
      ),
    )
    const checkResultsFlat = checkResults.flat()
    return [featureDocs, checkResultsFlat]
  }

  async checkFeature(featureId: string) {
    const topLevelFeature = await this.featureModel.findById(featureId).exec()
    if (!topLevelFeature) {
      return
    }
    return this.checksService.checkFeature(topLevelFeature)
  }

  async searchFeatures(searchDto: { term: string; assemblies: string }) {
    const { assemblies, term } = searchDto
    const assemblyIds = assemblies.split(',')
    const refSeqs = await this.refSeqModel
      .find({ assembly: assemblyIds })
      .exec()
    return this.featureModel
      .find({ $text: { $search: `"${term}"` }, refSeq: refSeqs })
      .populate('refSeq')
      .exec()
  }
}
