import gff, { GFF3FeatureLineWithRefs } from '@gmod/gff'
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
   * Get feature by featureId. When retrieving features by id, the features and any of its children are returned, but not any of its parent or sibling features.
   * @param featureid - featureId
   * @returns Return the feature(s) if search was successful. Otherwise throw exception
   */
  async getFeatureByFeatureId(featureId: string) {
    // Search correct feature
    const featureObject = await this.featureModel.findOne({ featureId }).exec()

    if (!featureObject) {
      const errMsg = `ERROR: The following featureId was not found in database ='${featureId}'`
      this.logger.error(errMsg)
      throw new NotFoundException(errMsg)
    }

    // const updatableObjectAsGFFItemArray = featureObject.gff3FeatureLineWithRefs as unknown as GFF3FeatureLineWithRefs[]
    // const featureAsGFFItemArray =
    //   featureObject as unknown as GFF3FeatureLineWithRefs[]
    this.logger.debug(`Feature found  = ${JSON.stringify(featureObject)}`)
    // Now we need to find correct top level feature or sub-feature inside the feature
    const foundFeature = await this.getObjectByFeatureId(
      featureObject,
      featureId,
    )
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
  async getObjectByFeatureId(
    entry: GFF3FeatureLineWithRefs,
    featureId: string,
  ) {
    // Loop all lines and add those into cache
    // for (const entry of featureObject) {
    this.logger.debug(`Entry=${JSON.stringify(entry)}`)
    if (entry.hasOwnProperty('featureId')) {
      const assignedVal: GFF3FeatureLineWithRefsAndFeatureId =
        Object.assign(entry)
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      this.logger.debug(`Top level featureId=${assignedVal.featureId!}`)
      // If matches
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      if (assignedVal.featureId! === featureId) {
        this.logger.debug(
          `Top level featureId matches in object ${JSON.stringify(
            assignedVal,
          )}`,
        )
        return entry
      }
      // Check if there is also childFeatures in parent feature and it's not empty
      if (
        entry.hasOwnProperty('child_features') &&
        Object.keys(assignedVal.child_features).length > 0
      ) {
        // Let's get featureId from recursive method
        this.logger.debug(
          `FeatureId was not found on top level so lets make recursive call...`,
        )
        const foundRecursiveObject = await this.getNestedFeatureByFeatureId(
          assignedVal,
          featureId,
        )
        if (foundRecursiveObject) {
          return foundRecursiveObject
        }
      }
    }
    // }
    return null
  }
  // /**
  //  * Get single feature by featureId
  //  * @param featureObject -
  //  * @param featureId -
  //  * @returns
  //  */
  // async getObjectByFeatureId(
  //   featureObject: GFF3FeatureLineWithRefs[],
  //   featureId: string,
  // ) {
  //   // Loop all lines and add those into cache
  //   for (const entry of featureObject) {
  //     this.logger.verbose(`Entry=${JSON.stringify(entry)}`)
  //     if (entry.hasOwnProperty('featureId')) {
  //       const assignedVal: GFF3FeatureLineWithRefsAndFeatureId =
  //         Object.assign(entry)
  //       // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  //       this.logger.verbose(`Top level featureId=${assignedVal.featureId!}`)
  //       // If matches
  //       // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  //       if (assignedVal.featureId! === featureId) {
  //         this.logger.debug(
  //           `Top level featureId matches in object ${JSON.stringify(
  //             assignedVal,
  //           )}`,
  //         )
  //         return entry
  //       }
  //       // Check if there is also childFeatures in parent feature and it's not empty
  //       if (
  //         entry.hasOwnProperty('child_features') &&
  //         Object.keys(assignedVal.child_features).length > 0
  //       ) {
  //         // Let's get featureId from recursive method
  //         this.logger.verbose(
  //           `FeatureId was not found on top level so lets make recursive call...`,
  //         )
  //         const foundRecursiveObject = await this.getNestedFeatureByFeatureId(
  //           assignedVal,
  //           featureId,
  //         )
  //         if (foundRecursiveObject) {
  //           return foundRecursiveObject
  //         }
  //       }
  //     }
  //   }
  //   return null
  // }

  /**
   *
   * @param parentFeature - parent feature where search will be started
   * @param featureId - featureId to search
   * @returns Found child feature, or return null if feature was not found
   */
  async getNestedFeatureByFeatureId(
    parentFeature: GFF3FeatureLineWithRefs,
    featureId: string,
  ) {
    // If there is child features and size is not 0
    if (
      parentFeature.hasOwnProperty('child_features') &&
      Object.keys(parentFeature.child_features).length > 0
    ) {
      // Loop each child feature
      for (
        let i = 0;
        i < Object.keys(parentFeature.child_features).length;
        i++
      ) {
        // There can be several features with same ID so we need to loop
        for (let j = 0; parentFeature.child_features[i].length > j; j++) {
          const assignedVal: GFF3FeatureLineWithRefsAndFeatureId =
            Object.assign(parentFeature.child_features[i][j])
          // Let's add featureId if it doesn't exist yet
          if (assignedVal.hasOwnProperty('featureId')) {
            this.logger.verbose(
              `Recursive object featureId=${assignedVal.featureId}`,
            )
            // If featureId matches
            if (assignedVal.featureId === featureId) {
              this.logger.verbose(
                `Found featureId from recursive object ${JSON.stringify(
                  assignedVal,
                )}`,
              )
              return assignedVal
            }
          }
          // Check if there is also childFeatures in parent feature and it's not empty
          if (
            assignedVal.hasOwnProperty('child_features') &&
            Object.keys(assignedVal.child_features).length > 0
          ) {
            // Let's add featureId to each child recursively
            const foundObject = (await this.getNestedFeatureByFeatureId(
              assignedVal,
              featureId,
            )) as GFF3FeatureLineWithRefs
            this.logger.verbose(
              `Found recursive object is ${JSON.stringify(foundObject)}`,
            )
            if (foundObject != null) {
              return foundObject
            }
          }
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
