/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import {
  Feature,
  type FeatureDocument,
  RefSeq,
  type RefSeqDocument,
} from '@apollo-annotation/schemas'
import { GetFeaturesOperation } from '@apollo-annotation/shared'
import { Injectable, Logger, NotFoundException } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model } from 'mongoose'

import { ChecksService } from '../checks/checks.service.js'
import type { FeatureRangeSearchDto } from '../entity/gff3Object.dto.js'
import { OperationsService } from '../operations/operations.service.js'

import type {
  FeatureCountRequest,
  GetByIndexedIdRequest,
} from './dto/feature.dto.js'

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

  async getByIndexedId(getByIndexedIdRequest: GetByIndexedIdRequest) {
    const { assemblies, id, topLevel } = getByIndexedIdRequest
    const refSeqsQuery: { refSeq?: RefSeqDocument[] } = {}
    if (assemblies) {
      const assemblyIds = assemblies.split(',')
      const refSeqs = await this.refSeqModel
        .find({ assembly: assemblyIds })
        .exec()
      refSeqsQuery.refSeq = refSeqs
    }
    const topLevelFeatures = await this.featureModel
      .find({ indexedIds: id, ...refSeqsQuery })
      .exec()
    if (topLevelFeatures.length === 0) {
      return []
    }
    if (topLevel) {
      return topLevelFeatures
    }
    return topLevelFeatures
      .map((topLevelFeature) => this.findIndexedId(id, topLevelFeature))
      .filter((feature): feature is Feature => feature !== undefined)
  }

  findIndexedId(id: string, feature: FeatureDocument): Feature | undefined {
    const { attributes } = feature.toObject({
      flattenMaps: true,
    })
    if (attributes) {
      for (const attributeValue of Object.values(attributes)) {
        if (attributeValue.includes(id)) {
          return feature
        }
      }
    }
    if (!feature.children) {
      return
    }
    for (const [, childFeature] of feature.children) {
      const subFeature = this.findIndexedId(id, childFeature as FeatureDocument)
      if (subFeature) {
        return subFeature
      }
    }
    return
  }

  async findByFeatureIds(featureIds: string[], topLevel?: boolean) {
    const foundFeatures: Feature[] = []
    // all featureIds that have already been fetched
    const fetchedFeatureIds = new Set<string>()

    for (const featureId of featureIds) {
      if (fetchedFeatureIds.has(featureId)) {
        this.logger.debug(`FeatureId ${featureId} already fetched, skipping...`)
        continue
      }

      try {
        const feature = await this.findById(featureId, topLevel)
        foundFeatures.push(feature)
        for (const id of feature.allIds) {
          fetchedFeatureIds.add(id)
        }
      } catch (error) {
        this.logger.error(
          `Error occurred while fetching feature ${featureId}`,
          error instanceof Error ? error.stack : String(error),
        )
      }
    }
    return foundFeatures
  }

  /**
   * Get feature by featureId. When retrieving features by id, the features and any of its children are returned, but not any of its parent or sibling features.
   * @param featureId - featureId
   * @param topLevel - If true, return the top level feature and its children. If false, return the requested feature and its children.
   * @returns Return the feature(s) if search was successful. Otherwise throw exception
   */
  async findById(featureId: string, topLevel?: boolean) {
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
    const foundFeature = this.getFeatureFromId(
      topLevelFeature,
      featureId,
      topLevel,
    )
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
  getFeatureFromId(
    feature: Feature,
    featureId: string,
    topLevel?: boolean,
    parent?: Feature | null,
  ): Feature | null {
    this.logger.verbose(`Entry=${JSON.stringify(feature)}`)

    if (feature._id.equals(featureId)) {
      this.logger.debug(
        `Top level featureId matches in object ${JSON.stringify(feature)}`,
      )
      if (topLevel && parent) {
        return parent
      }
      return feature
    }
    // Check if there is also childFeatures in parent feature and it's not empty
    // Let's get featureId from recursive method
    this.logger.debug(
      'FeatureId was not found on top level so lets make recursive call...',
    )
    for (const [, childFeature] of feature.children ?? new Map()) {
      const subFeature = this.getFeatureFromId(
        childFeature,
        featureId,
        topLevel,
        feature,
      )
      if (subFeature) {
        if (topLevel) {
          return feature
        }
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
    for (const featureDoc of featureDocs) {
      await this.checksService.checkFeature(featureDoc)
    }
    const checkResults = await this.checksService.findByRange(searchDto)
    return [featureDocs, checkResults]
  }

  async checkFeature(featureId: string, checkTimestamps = true) {
    const topLevelFeature = await this.featureModel.findById(featureId).exec()
    if (!topLevelFeature) {
      return
    }
    return this.checksService.checkFeature(topLevelFeature, checkTimestamps)
  }

  async searchFeatures(searchDto: { term: string; assemblies: string }) {
    const { assemblies, term } = searchDto
    const assemblyIds = assemblies.split(',')
    const refSeqs = await this.refSeqModel
      .find({ assembly: assemblyIds })
      .exec()
    return this.featureModel
      .find({ $text: { $search: `"${term}"` }, refSeq: refSeqs })
      .exec()
  }
}
