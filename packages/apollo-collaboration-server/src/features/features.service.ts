import * as fs from 'fs/promises'
import { join } from 'path'

import gff from '@gmod/gff'
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
    // Loop all lines
    for (const entry of arrayOfThings) {
      // eslint-disable-next-line prefer-const
      let featureIdArray: string[] = [] // Let's gather here all feature ids from each feature

      // Comment, Directive and FASTA -entries are not presented as an array
      if (Array.isArray(entry)) {
        this.logger.verbose(`ENTRY=${JSON.stringify(entry)}`)
        for (const val of entry) {
          // ------
          // const uid = uuidv4()
          // featureIdArray.push(uid)
          // const assignedVal: GFF3FeatureLineWithRefsAndFeatureId = {
          //   ...val,
          //   featureId,
          // }
          // -------------
          // Let's add featureId to parent feature if it doesn't exist
          const assignedVal: GFF3FeatureLineWithRefsAndFeatureId =
            Object.assign(val)
          const uid = uuidv4()
          assignedVal.featureId = uid
          // Add featureId into array
          featureIdArray.push(uid)

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
        }
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
          featureId: featureIdArray,
          gff3FeatureLineWithRefs: entry,
        })
        cnt++
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
