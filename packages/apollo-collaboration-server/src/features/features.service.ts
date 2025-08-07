/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import {
  Feature,
  FeatureDocument,
  RefSeq,
  RefSeqDocument,
} from '@apollo-annotation/schemas'
import { GetFeaturesOperation } from '@apollo-annotation/shared'
import { Injectable, Logger, NotFoundException } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { FilterQuery, Model, Types } from 'mongoose'

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
      .exec()
  }

  getFeatureAttributeValue(
    attributeName: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    attributes?: any,
  ): string | undefined {
    let attrs: Record<string, string[]> | undefined
    if (attributes instanceof Map) {
      attrs = Object.fromEntries(attributes.entries())
    } else if (attributes && typeof attributes === 'object') {
      // attributes is already a plain object
      attrs = attributes
    } else {
      this.logger.warn(
        `Attributes is not a Map or object: ${JSON.stringify(attributes)}`,
      )
      return undefined
    }

    if (
      attrs?.[attributeName] &&
      Array.isArray(attrs[attributeName]) &&
      attrs[attributeName].length > 0
    ) {
      return attrs[attributeName][0]
    }
    return undefined
  }

  async assignExternalIds(assemblyId: string): Promise<number> {
    const BATCH_SIZE = 250
    let updatedCount = 0

    const refSeqs = await this.refSeqModel.find({ assembly: assemblyId }).exec()
    const refSeqIds = refSeqs.map((r) => r._id as Types.ObjectId)

    if (refSeqIds.length === 0) {
      this.logger.warn(`No refSeqs found for assemblyId: ${assemblyId}`)
      return updatedCount
    }

    let lastId: Types.ObjectId | undefined = undefined

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    while (true) {
      const query: FilterQuery<FeatureDocument> = { refSeq: { $in: refSeqIds } }
      if (lastId) {
        query._id = { $gt: lastId }
      }

      const features = await this.featureModel
        // eslint-disable-next-line unicorn/no-array-callback-reference
        .find(query)
        .limit(BATCH_SIZE)
        .exec()

      this.logger.debug(`Processing batch of ${features.length} features`)

      if (features.length === 0) {
        break
      }

      const bulkOps = []
      for (const feature of features) {
        const externalIds: string[] = []

        const geneId =
          this.getFeatureAttributeValue('gene_id', feature.attributes) ??
          this.getFeatureAttributeValue('gff_id', feature.attributes)
        if (geneId && !feature.allExternalIds?.includes(geneId)) {
          externalIds.push(geneId)
        }

        // update transcripts
        for (const [, transcript] of feature.children ??
          new Map<string, Feature>()) {
          const transcriptId =
            this.getFeatureAttributeValue(
              'transcript_id',
              transcript.attributes,
            ) ?? this.getFeatureAttributeValue('gff_id', transcript.attributes)
          if (transcriptId && !feature.allExternalIds?.includes(transcriptId)) {
            externalIds.push(transcriptId)
          }

          // update exons and CDS
          for (const [, child] of transcript.children ??
            new Map<string, Feature>()) {
            if (child.type === 'exon') {
              const exonId =
                this.getFeatureAttributeValue('exon_id', child.attributes) ??
                this.getFeatureAttributeValue('gff_id', child.attributes)
              if (exonId && !feature.allExternalIds?.includes(exonId)) {
                externalIds.push(exonId)
              }
            }
            if (child.type === 'CDS') {
              const proteinId =
                this.getFeatureAttributeValue('protein_id', child.attributes) ??
                this.getFeatureAttributeValue('gff_id', child.attributes)
              if (proteinId && !feature.allExternalIds?.includes(proteinId)) {
                externalIds.push(proteinId)
              }
            }
          }
        }

        if (externalIds.length > 0) {
          feature.allExternalIds = externalIds
          bulkOps.push({
            updateOne: {
              filter: { _id: feature._id },
              update: {
                $set: {
                  allExternalIds: feature.allExternalIds,
                },
              },
            },
          })
        }
      }

      if (bulkOps.length > 0) {
        const result = await this.featureModel.bulkWrite(bulkOps)
        updatedCount += result.modifiedCount
      }

      // eslint-disable-next-line unicorn/prefer-at
      lastId = features[features.length - 1]._id
      this.logger.debug(`Updated ${updatedCount} features so far`)
    }

    return updatedCount
  }

  async findGeneByExternalId(externalId: string) {
    const feature = await this.featureModel
      .findOne({ allExternalIds: externalId })
      .exec()
    if (!feature) {
      throw new NotFoundException(
        `Gene with externalId ${externalId} not found`,
      )
    }
    return feature
  }
}
