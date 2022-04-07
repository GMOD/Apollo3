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

interface GFF3FeatureLineWithOptionalRefs extends GFF3FeatureLine {
  // eslint-disable-next-line camelcase
  child_features?: GFF3Feature[]
  // eslint-disable-next-line camelcase
  derived_features?: GFF3Feature[]
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
            .findOne({ assemblyId, name: refName })
            .exec()
          if (!refSeqDoc) {
            throw new NotFoundException(
              `RefSeq was not found by assemblyId "${assemblyId}" and seq_id "${refName}" not found`,
            )
          }
          const refSeqId = refSeqDoc._id
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
            `Added new feature for refSeq "${refSeqId}" into database`,
          )
          await this.featureModel.create({
            refSeqId,
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
}
