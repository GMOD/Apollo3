/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { Readable } from 'node:stream'
import { ReadableStream, TransformStream } from 'node:stream/web'

import {
  type CheckResultDocument,
  Feature,
  type FeatureDocument,
  RefSeq,
  type RefSeqDocument,
} from '@apollo-annotation/schemas'
import {
  type DensityStrand,
  type FeatureDensity,
  alignBins,
  coverageFromBoundaries,
  densityStrands,
  getDensityStrand,
} from '@apollo-annotation/shared'
import {
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  forwardRef,
} from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model, Types } from 'mongoose'

import { ChecksService } from '../checks/checks.service.js'
import type { FeatureRangeSearchDto } from '../entity/gff3Object.dto.js'
import { concatStreams } from '../utils/concatStreams.js'

import type {
  FeatureCountRequest,
  GetByIndexedIdRequest,
} from './dto/feature.dto.js'
import {
  CheckFeatureStream,
  DocToJSONArrayStream,
  lazyStream,
} from './transforms.js'

interface BinGroup {
  _id: { bin: number; strand?: number | null }
  count: number
}

function binCountPairs(groups: BinGroup[], densityStrand?: DensityStrand) {
  return groups
    .filter(
      ({ _id }) =>
        densityStrand === undefined ||
        getDensityStrand(_id.strand) === densityStrand,
    )
    .map(({ _id, count }): [number, number] => [_id.bin, count])
}

@Injectable()
export class FeaturesService {
  constructor(
    @Inject(forwardRef(() => ChecksService))
    private readonly checksService: Readonly<ChecksService>,
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

    if (end !== undefined) {
      filter.min = { $lte: end }
    }
    if (start !== undefined) {
      filter.max = { $gte: start }
    }

    if (refSeqId) {
      filter.refSeq = refSeqId
      count = await this.featureModel.countDocuments(filter)
    } else if (assemblyId) {
      const refSeqs: RefSeqDocument[] = await this.refSeqModel
        .find({ assembly: assemblyId })
        .exec()

      for (const refSeq of refSeqs) {
        filter.refSeq = refSeq._id.toString()
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
   * Count the features overlapping a range, and how many overlap each bin of
   * the range expanded to multiples of `binSize`
   * @param featureTypes - only count top-level features of these types, or
   * all features if empty
   */
  async getFeatureDensity(
    refSeq: string,
    start: number,
    end: number,
    binSize: number,
    featureTypes: string[] = [],
  ): Promise<FeatureDensity> {
    const aligned = alignBins(start, end, binSize)
    const alignedEnd = aligned.start + aligned.nBins * binSize
    // These mirror binRange() in @apollo-annotation/shared
    const firstBin = {
      $max: [
        0,
        {
          $floor: {
            $divide: [{ $subtract: ['$min', aligned.start] }, binSize],
          },
        },
      ],
    }
    const featureEnd = { $max: ['$max', { $add: ['$min', 1] }] }
    const endBin = {
      $add: [
        {
          $min: [
            aligned.nBins - 1,
            {
              $floor: {
                $divide: [
                  { $subtract: [featureEnd, aligned.start + 1] },
                  binSize,
                ],
              },
            },
          ],
        },
        1,
      ],
    }
    // Aggregations aren't cast by mongoose, so cast the ObjectId here
    const [result] = await this.featureModel.aggregate<{
      count: { count: number }[]
      firstBins: BinGroup[]
      endBins: BinGroup[]
    }>([
      {
        $match: {
          refSeq: new Types.ObjectId(refSeq),
          min: { $lt: alignedEnd },
          max: { $gt: aligned.start },
          status: 0,
          ...(featureTypes.length > 0 && { type: { $in: featureTypes } }),
        },
      },
      { $project: { _id: 0, min: 1, max: 1, strand: 1 } },
      {
        $facet: {
          count: [
            { $match: { min: { $lt: end }, max: { $gt: start } } },
            { $count: 'count' },
          ],
          firstBins: [
            {
              $group: {
                _id: { bin: firstBin, strand: '$strand' },
                count: { $sum: 1 },
              },
            },
          ],
          endBins: [
            {
              $group: {
                _id: { bin: endBin, strand: '$strand' },
                count: { $sum: 1 },
              },
            },
          ],
        },
      },
    ])
    if (!result) {
      throw new Error('Feature density aggregation returned no result')
    }
    return {
      count: result.count.at(0)?.count ?? 0,
      start: aligned.start,
      binSize,
      bins: coverageFromBoundaries(
        binCountPairs(result.firstBins),
        binCountPairs(result.endBins),
        aligned.nBins,
      ),
      strandBins: Object.fromEntries(
        densityStrands.map((densityStrand) => [
          densityStrand,
          coverageFromBoundaries(
            binCountPairs(result.firstBins, densityStrand),
            binCountPairs(result.endBins, densityStrand),
            aligned.nBins,
          ),
        ]),
      ) as Record<DensityStrand, number[]>,
    }
  }

  async getByIndexedId(getByIndexedIdRequest: GetByIndexedIdRequest) {
    const { assemblies, id, topLevel } = getByIndexedIdRequest
    const refSeqsQuery: { refSeq?: RefSeqDocument['_id'][] } = {}
    if (assemblies) {
      const assemblyIds = assemblies.split(',')
      const refSeqs = await this.refSeqModel
        .find({ assembly: assemblyIds })
        .exec()
      refSeqsQuery.refSeq = refSeqs.map((refSeq) => refSeq._id)
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
      const errMsg = `The following featureId was not found in database ='${featureId}'`
      this.logger.warn(errMsg)
      throw new NotFoundException(errMsg)
    }

    // Now we need to find correct top level feature or sub-feature inside the feature
    const foundFeature = this.getFeatureFromId(
      topLevelFeature,
      featureId,
      topLevel,
    )
    if (!foundFeature) {
      const errMsg = `Feature "${featureId}" not found in its top-level feature`
      this.logger.warn(errMsg)
      throw new NotFoundException(errMsg)
    }
    this.logger.debug(
      `Feature found: "${foundFeature._id.toString()}" (${foundFeature.type})`,
    )
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
    this.logger.debug(`Checking feature "${feature._id.toString()}"`)

    if (feature._id.equals(featureId)) {
      this.logger.debug(
        `Top level featureId matches in feature "${feature._id.toString()}"`,
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
    const featureDocs = await this.featureModel
      .find(this.byRangeQuery(searchDto))
      .exec()
    for (const featureDoc of featureDocs) {
      await this.checksService.checkFeature(featureDoc)
    }
    const checkResults = await this.checksService.findByRange(searchDto)
    return [featureDocs, checkResults]
  }

  /**
   * Same as findByRange, but streams the response instead of resolving the
   * full feature and checkResult arrays in memory first.
   * @param searchDto - range
   * @returns a stream of the JSON body `[[...features],[...checkResults]]`
   */
  findByRangeStream(searchDto: FeatureRangeSearchDto): Readable {
    // Record the span and IDs of the returned features so the checkResults
    // can be limited to those features, including checks outside the window
    let min = Number.POSITIVE_INFINITY
    let max = Number.NEGATIVE_INFINITY
    const featureIds = new Set<string>()
    const featuresStream = Readable.toWeb(
      this.featureModel.find(this.byRangeQuery(searchDto)).cursor(),
    )
      .pipeThrough(new CheckFeatureStream(this.checksService))
      .pipeThrough(
        new TransformStream<FeatureDocument, FeatureDocument>({
          transform(doc, controller) {
            min = Math.min(min, doc.min)
            max = Math.max(max, doc.max)
            for (const id of doc.allIds) {
              featureIds.add(id)
            }
            controller.enqueue(doc)
          },
        }),
      )
      .pipeThrough(new DocToJSONArrayStream())

    // Don't query the checkResults until the features stream is done, since
    // CheckFeatureStream updates them as it goes
    const checkResultsStream = lazyStream(() => {
      if (featureIds.size === 0) {
        return ReadableStream.from(['[]'])
      }
      return Readable.toWeb(
        this.checksService.findByRangeCursor({
          refSeq: searchDto.refSeq,
          start: min,
          end: max,
        }),
      )
        .pipeThrough(
          new TransformStream<CheckResultDocument, CheckResultDocument>({
            transform(doc, controller) {
              if (doc.ids.some((id) => featureIds.has(id.toString()))) {
                controller.enqueue(doc)
              }
            },
          }),
        )
        .pipeThrough(new DocToJSONArrayStream())
    })

    const openBracket = new ReadableStream<string>({
      start(controller) {
        controller.enqueue('[')
        controller.close()
      },
    })
    const comma = new ReadableStream<string>({
      start(controller) {
        controller.enqueue(',')
        controller.close()
      },
    })
    const closeBracket = new ReadableStream<string>({
      start(controller) {
        controller.enqueue(']')
        controller.close()
      },
    })

    return concatStreams([
      openBracket,
      featuresStream,
      comma,
      checkResultsStream,
      closeBracket,
    ])
  }

  private byRangeQuery(searchDto: FeatureRangeSearchDto) {
    return {
      refSeq: searchDto.refSeq,
      min: { $lte: searchDto.end },
      max: { $gte: searchDto.start },
      status: 0,
    }
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
      .find({
        $text: { $search: `"${term}"` },
        refSeq: refSeqs.map((refSeq) => refSeq._id),
      })
      .exec()
  }
}
