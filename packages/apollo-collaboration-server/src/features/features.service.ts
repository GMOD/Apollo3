import { Transform, pipeline } from 'stream'

import gff, { GFF3Feature } from '@gmod/gff'
import { Injectable, Logger, NotFoundException } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import {
  Assembly,
  AssemblyDocument,
  Export,
  ExportDocument,
  Feature,
  FeatureDocument,
  RefSeq,
  RefSeqDocument,
} from 'apollo-schemas'
import { GetFeaturesOperation } from 'apollo-shared'
import { Model } from 'mongoose'

import { FeatureRangeSearchDto } from '../entity/gff3Object.dto'
import { OperationsService } from '../operations/operations.service'

function makeGFF3Feature(
  featureDocument: Feature,
  refSeqs: RefSeqDocument[],
  parentId?: string,
): GFF3Feature {
  const locations = featureDocument.discontinuousLocations?.length
    ? featureDocument.discontinuousLocations
    : [{ start: featureDocument.start, end: featureDocument.end }]
  const attributes: Record<string, string[]> = {
    ...(featureDocument.attributes || {}),
  }
  const source = featureDocument.attributes?.source?.[0] || null
  delete attributes.source
  if (parentId) {
    attributes.Parent = [parentId]
  }
  if (attributes.id) {
    attributes.ID = attributes.id
    delete attributes.id
  }
  if (attributes.name) {
    attributes.Name = attributes.name
    delete attributes.name
  }
  if (attributes.note) {
    attributes.Note = attributes.note
    delete attributes.note
  }
  if (attributes.target) {
    attributes.Target = attributes.target
    delete attributes.target
  }
  if (attributes.alias) {
    attributes.Alias = attributes.alias
    delete attributes.alias
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
    score: featureDocument.score || null,
    strand: featureDocument.strand
      ? featureDocument.strand === 1
        ? '+'
        : '-'
      : null,
    phase: featureDocument.phase ? String(featureDocument.phase) : null,
    attributes: Object.keys(attributes).length ? attributes : null,
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
  ) {}

  private readonly logger = new Logger(FeaturesService.name)

  findAll() {
    return this.featureModel.find().exec()
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
    const refSeqIds = refSeqs.map((refSeq) => refSeq._id)
    const query = { refSeq: { $in: refSeqIds } }
    return [
      pipeline(
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
              callback(
                error instanceof Error ? error : new Error(String(error)),
              )
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
      ),
      assembly,
    ]
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
      const errMsg = `ERROR when searching feature by featureId`
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
      `FeatureId was not found on top level so lets make recursive call...`,
    )
    for (const [, childFeature] of feature.children || new Map()) {
      const subFeature = this.getFeatureFromId(childFeature, featureId)
      if (subFeature) {
        return subFeature
      }
    }
    return null
  }

  async findByRange(searchDto: FeatureRangeSearchDto) {
    return this.operationsService.executeOperation<GetFeaturesOperation>({
      typeName: 'GetFeaturesOperation',
      refSeq: searchDto.refSeq,
      start: searchDto.end,
      end: searchDto.start,
    })
  }
}
