import * as fs from 'fs/promises'
import { join } from 'path'

import gff, { GFF3FeatureLineWithRefs } from '@gmod/gff'
import {
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common'
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
import { getCurrentDateTime } from '../utils/commonUtilities'

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
   * Save new uploaded file into local filesystem. The filename in local filesystem will be: 'uploaded' + timestamp in ddmmyyyy_hh24miss -format + original filename
   * @param newUser - New user information
   * @returns Return 'HttpStatus.OK' if save was successful
   * or in case of error return error message with 'HttpStatus.INTERNAL_SERVER_ERROR'
   */
  async saveNewFile(file: Express.Multer.File) {
    // Check if filesize is 0
    if (file.size < 1) {
      const msg = `File ${file.originalname} is empty!`
      this.logger.error(msg)
      throw new InternalServerErrorException(msg)
    }
    this.logger.debug(
      `Starting to save file ${file.originalname}, size=${file.size} bytes.`,
    )
    const filenameWithoutPath = `uploaded_${getCurrentDateTime()}_${
      file.originalname
    }`

    // Join path+filename
    const { FILE_SEARCH_FOLDER } = process.env
    if (!FILE_SEARCH_FOLDER) {
      throw new Error('No FILE_SEARCH_FOLDER found in .env file')
    }
    const newFullFileName = join(FILE_SEARCH_FOLDER, filenameWithoutPath)
    this.logger.debug(`New file will be saved as ${newFullFileName}`)

    // Save file
    await fs.writeFile(newFullFileName, file.buffer)
    return filenameWithoutPath
  }

  /**
   * This method loads GFF3 data from file into db
   * @param filename - file that contains GFF3 data
   * @returns
   */
  async loadGFF3DataIntoDb(filename: string, assemblyId: string) {
    const assembly = await this.assemblyModel.findById(assemblyId).exec()
    if (!assembly) {
      throw new NotFoundException(`Assembly with id "${assemblyId}" not found`)
    }

    // parse a string of gff3 synchronously
    const { FILE_SEARCH_FOLDER } = process.env
    if (!FILE_SEARCH_FOLDER) {
      throw new Error('No FILE_SEARCH_FOLDER found in .env file')
    }
    this.logger.debug(
      `Starting to load gff3 file ${filename} into database! Whole file path is '${join(
        FILE_SEARCH_FOLDER,
        filename,
      )}'`,
    )

    const stringOfGFF3 = await fs.readFile(join(FILE_SEARCH_FOLDER, filename), {
      encoding: 'utf8',
      flag: 'r',
    })
    this.logger.verbose(`Data read from file=${stringOfGFF3}`)

    const arrayOfThings = gff.parseStringSync(stringOfGFF3, {
      parseAll: true,
    })
    let cnt = 0
    let currentSeqId = ''
    let refSeqId = ''
    let isFeature = false // Indicates if we need to get valid AssemblyId and refSeqId
    // Loop all lines
    for (const entry of arrayOfThings) {
      // eslint-disable-next-line prefer-const
      let featureIdArray: string[] = [] // Let's gather here all feature ids from each feature
      isFeature = false

      // Comment, Directive and FASTA -entries are not presented as an array
      if (Array.isArray(entry)) {
        isFeature = true
        this.logger.verbose(`ENTRY=${JSON.stringify(entry)}`)
        for (const [key, val] of Object.entries(entry)) {
          // Let's add featureId to parent feature if it doesn't exist
          const assignedVal: GFF3FeatureLineWithRefsAndFeatureId =
            Object.assign(val)
          const uid = uuidv4()
          assignedVal.featureId = uid
          // Add featureId into array
          featureIdArray.push(uid)
          // Pick up refSeq (i.e. seq_id)
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          currentSeqId = assignedVal.seq_id!
          this.logger.verbose(
            `Added new FeatureId: key=${JSON.stringify(
              key,
            )}, value=${JSON.stringify(val)}`,
          )
          // Check if there is also childFeatures in parent feature and it's not empty
          if (
            val.hasOwnProperty('child_features') &&
            Object.keys(assignedVal.child_features).length > 0
          ) {
            // Let's add featureId to each child recursively
            this.setAndGetFeatureIdRecursively(assignedVal, featureIdArray)
          }
        }
        this.logger.verbose(
          `So far apollo ids are: ${featureIdArray.toString()}\n`,
        )
      }
      // ******* TODO : CURRENTLY WE ADD ONLY FEATURES (I.E. NOT COMMENTS, DIRECTIVES AND SEQUENCES) INTO DATABASE ****************
      // If we are adding feature then we need to retrieve proper refSeqId
      if (isFeature) {
        const refSeqDoc = await this.refSeqModel
          .findOne({ assemblyId, name: currentSeqId })
          .exec()
        if (!refSeqDoc) {
          throw new NotFoundException(
            `RefSeq was not found by assemblyId "${assemblyId}" and seq_id "${currentSeqId}" not found`,
          )
        }
        refSeqId = refSeqDoc._id
        this.logger.debug(
          `Added new feature for refSeq "${refSeqId}" into database`,
        )
        await this.featureModel.create({
          refSeqId,
          featureId: featureIdArray,
          gff3FeatureLineWithRefs: entry,
        })
        cnt++
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

    const updatableObjectAsGFFItemArray =
      featureObject.gff3FeatureLineWithRefs as unknown as GFF3FeatureLineWithRefs[]
    this.logger.verbose(`Feature found  = ${JSON.stringify(featureObject)}`)
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
    // Loop all lines and add those into cache
    for (const entry of featureObject) {
      this.logger.verbose(`Entry=${JSON.stringify(entry)}`)
      if (entry.hasOwnProperty('featureId')) {
        const assignedVal: GFF3FeatureLineWithRefsAndFeatureId =
          Object.assign(entry)
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        this.logger.verbose(`Top level featureId=${assignedVal.featureId!}`)
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
          this.logger.verbose(
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
          if (!assignedVal.hasOwnProperty('featureId')) {
            const uid = uuidv4()
            assignedVal.featureId = uid
            this.logger.verbose(
              `FeatureId assigned (recursive level) ${JSON.stringify(
                assignedVal,
              )}`,
            )
            featureIdArrAsParam.push(uid)
          }
          this.setAndGetFeatureIdRecursively(assignedVal, featureIdArrAsParam)
        }
      }
    }
    return featureIdArrAsParam
  }
}
