import gff, { GFF3Feature, GFF3FeatureLine } from '@gmod/gff'
import { Injectable, Logger, NotFoundException } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import {
  Assembly,
  AssemblyDocument,
  Feature,
  FeatureDocument,
  RefSeq,
  RefSeqDocument,
} from 'apollo-schemas'
import { Model } from 'mongoose'
import { v4 as uuidv4 } from 'uuid'

import { FeatureRangeSearchDto } from '../entity/gff3Object.dto'

interface GFF3FeatureLineWithOptionalRefs extends GFF3FeatureLine {
  // eslint-disable-next-line camelcase
  child_features?: GFF3Feature[]
  // eslint-disable-next-line camelcase
  derived_features?: GFF3Feature[]
}

export interface GFF3FeatureLineWithFeatureIdAndOptionalRefs
  extends GFF3FeatureLineWithOptionalRefs {
  featureId: string
}

@Injectable()
export class FeaturesService {
  constructor(
    @InjectModel(Feature.name)
    private readonly featureModel: Model<FeatureDocument>,
    @InjectModel(Assembly.name)
    private readonly assemblyModel: Model<AssemblyDocument>,
    @InjectModel(RefSeq.name)
    private readonly refSeqModel: Model<RefSeqDocument>,
  ) {}

  private readonly logger = new Logger(FeaturesService.name)

  findAll() {
    return this.featureModel.find().exec()
  }

  /**
   * This method loads GFF3 data from file into db
   * @param file - GFF3 file
   * @param assemblyId - AssemblyId where features will be added
   * @returns
   */
  async loadGFF3DataIntoDb(file: Express.Multer.File, assemblyId: string) {
    const assembly = await this.assemblyModel.findById(assemblyId).exec()
    if (!assembly) {
      throw new NotFoundException(`Assembly with id "${assemblyId}" not found`)
    }

    const stringOfGFF3 = file.buffer.toString('utf-8')
    this.logger.verbose(`Data read from file=${stringOfGFF3}`)

    const gff3Items = gff.parseStringSync(stringOfGFF3, {
      parseSequences: false,
    })
    let cnt = 0
    for (const gff3Item of gff3Items) {
      if (Array.isArray(gff3Item)) {
        // gff3Item is a GFF3Feature
        this.logger.verbose(`ENTRY=${JSON.stringify(gff3Item)}`)
        for (const featureLine of gff3Item) {
          const refName = featureLine.seq_id
          if (!refName) {
            throw new Error(
              `Valid seq_id not found in feature ${JSON.stringify(
                featureLine,
              )}`,
            )
          }
          const refSeqDoc = await this.refSeqModel
            .findOne({ assembly: assemblyId, name: refName })
            .exec()
          if (!refSeqDoc) {
            throw new NotFoundException(
              `RefSeq was not found by assemblyId "${assemblyId}" and seq_id "${refName}" not found`,
            )
          }
          const refSeq = refSeqDoc._id
          // Let's add featureId to parent feature
          const featureId = uuidv4()
          const featureIds = [featureId]
          this.logger.verbose(
            `Added new FeatureId: value=${JSON.stringify(featureLine)}`,
          )

          // Let's add featureId to each child recursively
          this.setAndGetFeatureIdRecursively(featureLine, featureIds)
          this.logger.verbose(
            `So far apollo ids are: ${featureIds.toString()}\n`,
          )

          this.logger.verbose(
            `Added new feature for refSeq "${refSeq}" into database`,
          )
          await this.featureModel.create({
            refSeq,
            featureId,
            featureIds,
            ...featureLine,
          })
          cnt++
        }
        // May handle comments, directives, or sequences here in the future
      } // else {}
    }
    this.logger.debug(`Added ${cnt} features into database`)
  }

  /**
   * Get feature by featureId. When retrieving features by id, the features and any of its children are returned, but not any of its parent or sibling features.
   * @param featureid - featureId
   * @returns Return the feature(s) if search was successful. Otherwise throw exception
   */
  async findById(featureId: string) {
    // Search correct feature
    const topLevelFeature = await this.featureModel
      .findOne({ featureIds: featureId })
      .exec()

    if (!topLevelFeature) {
      const errMsg = `ERROR: The following featureId was not found in database ='${featureId}'`
      this.logger.error(errMsg)
      throw new NotFoundException(errMsg)
    }

    // Now we need to find correct top level feature or sub-feature inside the feature
    const foundFeature = this.getObjectByFeatureId(topLevelFeature, featureId)
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
   * @param featureObject -
   * @param featureId -
   * @returns
   */
  getObjectByFeatureId(
    feature: GFF3FeatureLineWithFeatureIdAndOptionalRefs,
    featureId: string,
  ): GFF3FeatureLineWithFeatureIdAndOptionalRefs | null {
    this.logger.verbose(`Entry=${JSON.stringify(feature)}`)

    this.logger.debug(`Top level featureId=${feature.featureId}`)
    if (feature.featureId === featureId) {
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
    for (const childFeature of feature.child_features || []) {
      for (const childFeatureLine of childFeature) {
        const subFeature: GFF3FeatureLineWithFeatureIdAndOptionalRefs | null =
          this.getObjectByFeatureId(
            childFeatureLine as GFF3FeatureLineWithFeatureIdAndOptionalRefs,
            featureId,
          )
        if (subFeature) {
          return subFeature
        }
      }
    }
    return null
  }

  /**
   * Loop child features in parent feature and add featureId to each child's attribute
   * @param parentFeature - Parent feature
   */
  setAndGetFeatureIdRecursively(
    parentFeature: GFF3FeatureLineWithOptionalRefs,
    featureIdArrAsParam: string[],
  ): string[] {
    this.logger.verbose(
      `Value in recursive method = ${JSON.stringify(parentFeature)}`,
    )
    if (parentFeature.child_features?.length === 0) {
      delete parentFeature.child_features
    }
    if (parentFeature.derived_features?.length === 0) {
      delete parentFeature.derived_features
    }
    // If there are child features
    if (parentFeature.child_features) {
      parentFeature.child_features = parentFeature.child_features.map(
        (childFeature) =>
          childFeature.map((childFeatureLine) => {
            const featureId = uuidv4()
            featureIdArrAsParam.push(featureId)
            const newChildFeature = { ...childFeatureLine, featureId }
            this.setAndGetFeatureIdRecursively(
              newChildFeature,
              featureIdArrAsParam,
            )
            return newChildFeature
          }),
      )
    }
    return featureIdArrAsParam
  }

  /**
   * Fetch features based on Reference seq, Start and End -values
   * @param request - Contain search criteria i.e. refname, start and end -parameters
   * @returns Return 'HttpStatus.OK' and array of features if search was successful
   * or if search data was not found or in case of error throw exception
   */
  async getFeaturesByCriteria(searchDto: FeatureRangeSearchDto) {
    // Search refSeqs by assemblyId
    const refSeqs = await this.refSeqModel
      .find({ assembly: searchDto.assemblyId })
      .exec()
    if (refSeqs.length < 1) {
      const errMsg = `ERROR: No RefSeqs were found for assemblyId: ${searchDto.assemblyId}`
      this.logger.error(errMsg)
      throw new NotFoundException(errMsg)
    }
    const refSeqIdIdArray = refSeqs.map((refSeq) => refSeq._id)
    this.logger.verbose(`Found refSeqs: ${refSeqIdIdArray}`)

    // Search feature
    const features = await this.featureModel
      .find({
        seq_id: searchDto.refName,
        start: { $lte: searchDto.end },
        end: { $gte: searchDto.start },
        refSeqId: refSeqIdIdArray,
      })
      .exec()
    this.logger.debug(
      `Searching features for AssemblyId: ${searchDto.assemblyId}, refName: ${searchDto.refName}, start: ${searchDto.start}, end: ${searchDto.end}`,
    )

    this.logger.verbose(
      `The following feature(s) matched  = ${JSON.stringify(features)}`,
    )
    return features
  }
}
