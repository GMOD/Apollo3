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
import {
  LocationEndChange,
  LocationStartChange,
  SerializedChange,
  changeRegistry,
} from 'apollo-shared'
import { Model } from 'mongoose'
import { v4 as uuidv4 } from 'uuid'

import { FeatureRangeSearchDto } from '../entity/gff3Object.dto'
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
  ) {
    changeRegistry.registerChange('LocationEndChange', LocationEndChange) // Do this only once
    changeRegistry.registerChange('LocationStartChange', LocationStartChange) // Do this only once
  }

  private readonly logger = new Logger(FeaturesService.name)

  /**
   * Changes End -position in GFF3
   */
  async changeEndPos(serializedChange: SerializedChange) {
    const ChangeType = changeRegistry.getChangeType(serializedChange.typeName)
    const change = new ChangeType(serializedChange)
    this.logger.debug(`Requested change: ${JSON.stringify(change)}`)
    try {
      await change.apply({
        typeName: 'LocalGFF3',
        featureModel: this.featureModel,
      })
    } catch (error) {
      throw error
    }
    return []
  }

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
            allFeatureIds: featureIdArray,
            ...assignedVal,
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
    const featureObject = await this.featureModel
      .findOne({ allFeatureIds: featureId })
      .exec()

    if (!featureObject) {
      const errMsg = `ERROR: The following featureId was not found in database ='${featureId}'`
      this.logger.error(errMsg)
      throw new NotFoundException(errMsg)
    }

    // Let's check if featureId is parent feature --> return parent + children
    const parentFeature = await this.featureModel
      .findOne({ parentFeatureId: featureId })
      .exec()
    if (parentFeature) {
      this.logger.debug(
        `Feature was parent level feature: ${JSON.stringify(parentFeature)}`,
      )
      return parentFeature
    }
    this.logger.verbose(`Feature found: ${JSON.stringify(featureObject)}`)

    // Now we need to find correct top level feature or sub-feature inside the feature
    const foundFeature = await this.getObjectByFeatureId(
      updatableObjectAsGFFItemArray,
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
    featureObject: GFF3FeatureLineWithRefs[],
    featureId: string,
  ) {
    this.logger.verbose(`Entry=${JSON.stringify(entry)}`)
    if ('featureId' in entry) {
      const assignedVal: GFF3FeatureLineWithRefsAndFeatureId =
        Object.assign(entry)

      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      this.logger.debug(`Top level featureId=${assignedVal.featureId!}`)
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
        'child_features' in entry &&
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
    return null
  }

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
      'child_features' in parentFeature &&
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
          if ('featureId' in assignedVal) {
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
            'child_features' in assignedVal &&
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

    if (features.length < 1) {
      const errMsg = `ERROR: No features were found in database`
      this.logger.error(errMsg)
      throw new NotFoundException(errMsg)
    }

    this.logger.verbose(
      `The following feature(s) matched  = ${JSON.stringify(features)}`,
    )
    return features
  }
}
