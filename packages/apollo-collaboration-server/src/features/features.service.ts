import gff from '@gmod/gff'
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

import { GFF3FeatureLineWithRefsAndFeatureId } from '../model/gff3.model'

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

    const arrayOfThings = gff.parseStringSync(stringOfGFF3, {
      parseAll: true,
    })
    let cnt = 0
    let currentSeqId = ''
    let refSeqId = ''
    let parentFeatureId = ''
    // Loop all lines
    for (const entry of arrayOfThings) {
      // eslint-disable-next-line prefer-const
      let featureIdArray: string[] = [] // Let's gather here all feature ids from each feature

      // Comment, Directive and FASTA -entries are not presented as an array
      if (Array.isArray(entry)) {
        this.logger.verbose(`ENTRY=${JSON.stringify(entry)}`)
        for (const val of entry) {
          // Let's add featureId to parent feature if it doesn't exist
          const featureId = uuidv4()
          parentFeatureId = featureId
          featureIdArray.push(featureId)
          const assignedVal: GFF3FeatureLineWithRefsAndFeatureId = {
            ...val,
            featureId,
          }
          // Pick up refSeq (i.e. seq_id)
          const refName = assignedVal.seq_id
          if (!refName) {
            throw new Error(
              `Valid seq_id not found in feature ${JSON.stringify(val)}`,
            )
          }
          currentSeqId = refName
          this.logger.verbose(
            `Added new FeatureId: value=${JSON.stringify(val)}`,
          )

          // Let's add featureId to each child recursively
          this.setAndGetFeatureIdRecursively(assignedVal, featureIdArray)
          this.logger.verbose(
            `So far apollo ids are: ${featureIdArray.toString()}\n`,
          )
          const refSeqDoc = await this.refSeqModel
            .findOne({ assemblyId, name: currentSeqId })
            .exec()
          if (!refSeqDoc) {
            throw new NotFoundException(
              `RefSeq was not found by assemblyId "${assemblyId}" and seq_id "${currentSeqId}" not found`,
            )
          }
          refSeqId = refSeqDoc._id
          this.logger.verbose(
            `Added new feature for refSeq "${refSeqId}" into database`,
          )
          await this.featureModel.create({
            refSeqId,
            parentFeatureId,
            featureId: featureIdArray,
            ...val,
          })
          cnt++
        }
      }
    }
    this.logger.debug(`Added ${cnt} features into database`)
  }

  /**
   * Loop child features in parent feature and add featureId to each child's attribute
   * @param parentFeature - Parent feature
   */
  setAndGetFeatureIdRecursively(
    parentFeature: GFF3FeatureLineWithRefsAndFeatureId,
    featureIdArrAsParam: string[],
  ): string[] {
    this.logger.verbose(
      `Value in recursive method = ${JSON.stringify(parentFeature)}`,
    )
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
      ) as GFF3FeatureLineWithRefsAndFeatureId[][]
    }
    return featureIdArrAsParam
  }
}
