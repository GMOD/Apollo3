import { Readable, Transform, pipeline } from 'node:stream'

import gff, { GFF3Feature } from '@gmod/gff'
import { Injectable, Logger, NotFoundException } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import {
  Assembly,
  AssemblyDocument,
  CheckReport,
  CheckReportDocument,
  Export,
  ExportDocument,
  Feature,
  FeatureDocument,
  RefSeq,
  RefSeqDocument,
} from 'apollo-schemas'
import { GetFeaturesOperation } from 'apollo-shared'
import ObjectID from 'bson-objectid'
import { Model } from 'mongoose'
import StreamConcat from 'stream-concat'

import {
  CheckReportResultDto,
  FeatureRangeSearchDto,
} from '../entity/gff3Object.dto'
import { OperationsService } from '../operations/operations.service'
import { FeatureCountRequest } from './dto/feature.dto'

function makeGFF3Feature(
  featureDocument: Feature,
  refSeqs: RefSeqDocument[],
  parentId?: string,
): GFF3Feature {
  const locations = featureDocument.discontinuousLocations?.length
    ? featureDocument.discontinuousLocations
    : [
        {
          start: featureDocument.start,
          end: featureDocument.end,
          phase: featureDocument.phase,
        },
      ]
  const attributes: Record<string, string[]> = { ...featureDocument.attributes }
  const ontologyTerms: string[] = []
  const source = featureDocument.attributes?.source?.[0] ?? null
  delete attributes.source
  if (parentId) {
    attributes.Parent = [parentId]
  }
  if (attributes._id) {
    attributes.ID = attributes._id
    delete attributes._id
  }
  if (attributes.gff_name) {
    attributes.Name = attributes.gff_name
    delete attributes.gff_name
  }
  if (attributes.gff_alias) {
    attributes.Alias = attributes.gff_alias
    delete attributes.gff_alias
  }
  if (attributes.gff_target) {
    attributes.Target = attributes.gff_target
    delete attributes.gff_target
  }
  if (attributes.gff_gap) {
    attributes.Gap = attributes.gff_gap
    delete attributes.gff_gap
  }
  if (attributes.gff_derives_from) {
    attributes.Derives_from = attributes.gff_derives_from
    delete attributes.gff_derives_from
  }
  if (attributes.gff_note) {
    attributes.Note = attributes.gff_note
    delete attributes.gff_note
  }
  if (attributes.gff_dbxref) {
    attributes.Dbxref = attributes.gff_dbxref
    delete attributes.gff_dbxref
  }
  if (attributes.gff_is_circular) {
    attributes.Is_circular = attributes.gff_is_circular
    delete attributes.gff_is_circular
  }
  if (attributes.gff_ontology_term) {
    ontologyTerms.push(...attributes.gff_ontology_term)
    delete attributes.gff_ontology_term
  }
  if (attributes['Gene Ontology']) {
    ontologyTerms.push(...attributes['Gene Ontology'])
    delete attributes['Gene Ontology']
  }
  if (attributes['Sequence Ontology']) {
    ontologyTerms.push(...attributes['Sequence Ontology'])
    delete attributes['Sequence Ontology']
  }
  if (ontologyTerms.length > 0) {
    attributes.Ontology_term = ontologyTerms
  }
  const refSeq = refSeqs.find((rs) => rs._id.equals(featureDocument.refSeq))
  if (!refSeq) {
    throw new Error(`Could not find refSeq ${featureDocument.refSeq}`)
  }
  return locations.map((location) => ({
    start: location.start,
    end: location.end,
    seq_id: refSeq.name,
    source,
    type: featureDocument.type,
    score: featureDocument.score ?? null,
    strand: featureDocument.strand
      ? featureDocument.strand === 1
        ? '+'
        : '-'
      : null,
    phase:
      location.phase === 0
        ? '0'
        : location.phase === 1
        ? '1'
        : location.phase === 2
        ? '2'
        : null,
    attributes: Object.keys(attributes).length > 0 ? attributes : null,
    derived_features: [],
    child_features: featureDocument.children
      ? Object.values(featureDocument.children).map((child) =>
          makeGFF3Feature(child, refSeqs, attributes.ID[0]),
        )
      : [],
  }))
}

@Injectable()
export class FeaturesService {
  constructor(
    private readonly operationsService: OperationsService,
    @InjectModel(Feature.name)
    private readonly featureModel: Model<FeatureDocument>,
    @InjectModel(Assembly.name)
    private readonly assemblyModel: Model<AssemblyDocument>,
    @InjectModel(RefSeq.name)
    private readonly refSeqModel: Model<RefSeqDocument>,
    @InjectModel(Export.name)
    private readonly exportModel: Model<ExportDocument>,
    @InjectModel(CheckReport.name)
    private readonly checkReportModel: Model<CheckReportDocument>,
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

  async getExportID(assembly: string) {
    return this.exportModel.create({ assembly })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async exportGFF3(exportID: string): Promise<any> {
    const exportDoc = await this.exportModel.findById(exportID)
    if (!exportDoc) {
      throw new NotFoundException()
    }

    const { assembly } = exportDoc
    const refSeqs = await this.refSeqModel.find({ assembly }).exec()

    const headerStream = new Readable({ objectMode: true })
    headerStream.push('##gff-version 3\n')
    for (const refSeqDoc of refSeqs) {
      headerStream.push(
        `##sequence-region ${refSeqDoc.name} 1 ${refSeqDoc.length}\n`,
      )
    }
    headerStream.push(null)

    const refSeqIds = refSeqs.map((refSeq) => refSeq._id)
    const query = { refSeq: { $in: refSeqIds } }

    const featureStream = pipeline(
      // unicorn thinks this is an Array.prototype.find, so we ignore it
      // eslint-disable-next-line unicorn/no-array-callback-reference
      this.featureModel.find(query).cursor(),
      new Transform({
        writableObjectMode: true,
        readableObjectMode: true,
        transform: (chunk, encoding, callback) => {
          try {
            const flattened = chunk.toObject({ flattenMaps: true })
            const gff3Feature = makeGFF3Feature(flattened, refSeqs)
            callback(null, gff3Feature)
          } catch (error) {
            callback(error instanceof Error ? error : new Error(String(error)))
          }
        },
      }),
      gff.formatStream({ insertVersionDirective: true }),
      (error) => {
        if (error) {
          this.logger.error('GFF3 export failed')
          this.logger.error(error)
        }
      },
    )
    const combinedStream = new StreamConcat([headerStream, featureStream])
    return [combinedStream, assembly]
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
    const features =
      await this.operationsService.executeOperation<GetFeaturesOperation>({
        typeName: 'GetFeaturesOperation',
        refSeq: searchDto.refSeq,
        start: searchDto.start,
        end: searchDto.end,
      })

    const featureIds: string[] = features.flatMap((doc) => doc.allIds)
    const checkReports: CheckReportResultDto[] = await this.checkReportModel
      .find({ pass: false, ignored: '', ids: { $in: featureIds } })
      .exec()
    if (checkReports) {
      // If there are check reports then check that each feature timestamp is less than in the check reports
      const maxFeatureTimestamp = await this.featureModel
        .aggregate([
          {
            $match: {
              $and: [
                { refSeq: { $eq: ObjectID(searchDto.refSeq) } },
                { start: { $gte: Number(searchDto.start) } },
                { end: { $lte: Number(searchDto.end) } },
                { status: 0 },
              ],
            },
          },
          {
            $group: {
              _id: null,
              maxUpdatedAt: { $max: '$updatedAt' },
            },
          },
        ])
        .exec()

      // Get max timestamp from checkReports -collection
      const maxCheckReportsTimestamp = await this.checkReportModel
        .aggregate([
          {
            $match: {
              $and: [{ ids: { $in: featureIds } }],
            },
          },
          {
            $group: {
              _id: null,
              maxUpdatedAt: { $max: '$updatedAt' },
            },
          },
        ])
        .exec()

      if (maxCheckReportsTimestamp[0] && maxFeatureTimestamp[0]) {
        this.logger.debug(
          `Within search range, max timestamp in Feature -collection: ${JSON.stringify(
            maxFeatureTimestamp[0].maxUpdatedAt,
          )}`,
        )
        this.logger.debug(
          `Within search range, max timestamp in CheckReports -collection: ${JSON.stringify(
            maxCheckReportsTimestamp[0].maxUpdatedAt,
          )}`,
        )
        if (
          new Date(maxFeatureTimestamp[0].maxUpdatedAt) >
          new Date(maxCheckReportsTimestamp[0].maxUpdatedAt)
        ) {
          this.logger.error(
            'The last Feature timestamp cannot be later than the last CheckReport timestamp',
          )
          // const errMsg =
          //   'ERROR:The last Feature timestamp cannot be later than the last CheckReport timestamp'
          // this.logger.error(errMsg)
          // throw new NotAcceptableException(errMsg)
        }
      }
    }
    return { features, checkReports }
  }

  async searchFeatures(searchDto: { term: string; assemblies: string }) {
    const { assemblies, term } = searchDto
    const assemblyIds = assemblies.split(',')
    const refSeqs = await this.refSeqModel
      .find({ assembly: assemblyIds })
      .exec()
    return this.featureModel
      .find({ $text: { $search: term }, refSeq: refSeqs })
      .populate('refSeq')
      .exec()
  }
}
