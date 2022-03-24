import * as fs from 'fs/promises'
import { join } from 'path'

import gff, { GFF3FeatureLine, GFF3FeatureLineWithRefs } from '@gmod/gff'
import {
  CACHE_MANAGER,
  Inject,
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
} from 'apollo-shared'
import { Cache } from 'cache-manager'
import { Model } from 'mongoose'
import { v4 as uuidv4 } from 'uuid'

import { UpdateEndObjectDto } from '../entity/gff3Object.dto'
import { GFF3FeatureLineWithRefsAndFeatureId } from '../model/gff3.model'

@Injectable()
export class FeaturesService {
  constructor(
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    @InjectModel(Feature.name)
    private readonly featureModel: Model<FeatureDocument>,
    @InjectModel(Assembly.name)
    private readonly assemblyModel: Model<AssemblyDocument>,
    @InjectModel(RefSeq.name)
    private readonly refSeqModel: Model<RefSeqDocument>,
  ) {}

  private readonly logger = new Logger(FeaturesService.name)

  /**
   * This method loads GFF3 data from db into cache if data exists in db. If db is empty then load GFF3 data from file into db and cache
   * @param filename - file that contains GFF3 data
   * @returns
   */
  async loadGFF3DataIntoDb(filename: string) {
    // TODO : CHECK THAT ASSEMBLY ID EXISTS IN MONGO ********* SHALL WE GET IT AS PARAMETER????
    //  ************* NOW WE JUST PICK UP ANY ASSEMBLY ID FROM MONGO *********************

    // Check if Gff3Item collection is empty in db
    const cnt = await this.featureModel.count({})
    if (cnt > 1) {
      this.logger.debug(
        `There are ${cnt} records in Feature -collection (in database). Let's load them into cache...`,
      )
      await this.loadGFF3FromDbIntoCache()
      this.logger.debug(`Cache loaded.`)
      return
    }
    this.logger.debug(
      `There are no Features in database so let's load that from file....`,
    )
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
    // Clear old entries from cache
    this.cacheManager.reset()

    const arrayOfThings = gff.parseStringSync(stringOfGFF3, {
      parseAll: true,
    })
    let ind = 0

    // Loop all lines
    for (const entry of arrayOfThings) {
      // eslint-disable-next-line prefer-const
      let featureIdArray: string[] = [] // Let's gather here all feature ids from each feature
      // Comment, Directive and FASTA -entries are not presented as an array so let's put entry into array because gff.formatSync() -method requires an array as argument
      this.cacheManager.set(ind.toString(), JSON.stringify(entry))
      this.logger.verbose(`Add into cache new entry=${JSON.stringify(entry)}\n`)

      // Comment, Directive and FASTA -entries are not presented as an array
      if (Array.isArray(entry)) {
        this.logger.verbose(`ENTRY=${JSON.stringify(entry)}`)
        for (const [key, val] of Object.entries(entry)) {
          // Let's add featureId to parent feature if it doesn't exist
          const assignedVal: GFF3FeatureLineWithRefsAndFeatureId =
            Object.assign(val)
          const uid = uuidv4()
          assignedVal.featureId = uid
          // Add featureId into array
          featureIdArray.push(uid)

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
      const newGFFItem = await this.featureModel.create({
        refSeqId: 'ref seq id 1', // Demo data ******* TODO : PUT HERE REAL REFSEQID ****************
        featureId: featureIdArray,
        gff3FeatureLineWithRefs: entry,
      })
      this.logger.debug(`Added new feature: ${newGFFItem}`)
      ind++
    }

    const nberOfEntries = await this.cacheManager.store.keys?.()
    this.logger.debug(
      `Added ${nberOfEntries.length} entries to cache and database`,
    )
  }

  /**
   * Loads GFF3 data from db into cache
   */
  async loadGFF3FromDbIntoCache() {
    // Search correct feature
    const allFeaturesCursor = await this.featureModel.find({}).cursor()

    if (!allFeaturesCursor) {
      const errMsg = `ERROR when loading data from database into cache: No data found!`
      this.logger.error(errMsg)
      throw new NotFoundException(errMsg)
    }
    let ind = 0
    // Loop all documents and load them into cache
    for (
      let currentDoc = await allFeaturesCursor.next();
      currentDoc != null;
      currentDoc = await allFeaturesCursor.next()
    ) {
      const entry = currentDoc as unknown as GFF3FeatureLineWithRefs[]
      if (Array.isArray(entry)) {
        this.cacheManager.set(ind.toString(), JSON.stringify(entry))
        this.logger.verbose(`Add into cache new entry=${JSON.stringify(entry)}`)
        ind++
      }
    }
    const nberOfEntries = await this.cacheManager.store.keys?.()
    this.logger.verbose(`Added ${nberOfEntries.length} entries to cache`)
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

  /**
   * Fetch features based on Reference seq, Start and End -values
   * @param request - Contain search criteria i.e. refname, start and end -parameters
   * @returns Return 'HttpStatus.OK' and array of features if search was successful
   * or if search data was not found or in case of error throw exception
   */
  async getFeaturesByCriteria(searchDto: GFF3FeatureLine) {
    // Search correct feature
    const features = await this.featureModel
      .find({
        'gff3FeatureLineWithRefs.start': { $lte: searchDto.end },
        'gff3FeatureLineWithRefs.end': { $gte: searchDto.start },
        'gff3FeatureLineWithRefs.seq_id': searchDto.seq_id,
      })
      .exec()
    this.logger.debug(
      `Searching features for Seq_id=${searchDto.seq_id}=, Start=${searchDto.start}=, End=${searchDto.end}=`,
    )

    if (!features) {
      const errMsg = `ERROR: No features were found in database`
      this.logger.error(errMsg)
      throw new NotFoundException(errMsg)
    }

    this.logger.debug(
      `The following feature(s) matched  = ${JSON.stringify(features)}`,
    )
    return features
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

  //  * DEMO - SEARCH RECURSIVELY CORRECT OBJECT FROM FEATRUE
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
   * Updates end position of given feature. Before update, current end -position value is checked (against given old-value)
   * @param postDto - Interface containing featureId, newEndValue, oldEndValue
   * @returns Return 'HttpStatus.OK' if featureId was found AND oldEndValue matched AND database update was successfull. Otherwise throw exception.
   */
  async updateEndPosInMongo(postDto: UpdateEndObjectDto) {
    const { featureId } = postDto
    const oldValue = postDto.oldEnd
    const newValue = postDto.newEnd

    // Search correct feature
    const featureObject = await this.featureModel.findOne({ featureId }).exec()

    if (!featureObject) {
      const errMsg = `ERROR when updating MongoDb: The following featureId was not found in database: '${featureId}'`
      this.logger.error(errMsg)
      throw new NotFoundException(errMsg)
    }

    const updatableObjectAsGFFItemArray =
      featureObject.gff3FeatureLineWithRefs as unknown as GFF3FeatureLineWithRefs[]
    this.logger.verbose(`Feature found  = ${JSON.stringify(featureObject)}`)
    // Now we need to find correct top level feature or sub-feature inside the feature
    const updatableObject = await this.getObjectByFeatureId(
      updatableObjectAsGFFItemArray,
      featureId,
    )
    if (!updatableObject) {
      const errMsg = `ERROR when updating MongoDb....`
      this.logger.error(errMsg)
      throw new NotFoundException(errMsg)
    }
    this.logger.debug(`Object found: ${JSON.stringify(updatableObject)}`)
    const assignedVal: GFF3FeatureLineWithRefs = Object.assign(updatableObject)
    if (assignedVal.end !== Number.parseInt(oldValue, 10)) {
      const errMsg = `Old end value in db ${assignedVal.end} does not match with old value ${oldValue} as given in parameter`
      this.logger.error(errMsg)
      throw new NotFoundException(errMsg)
    }
    // Set new value
    assignedVal.end = Number.parseInt(newValue, 10)
    await featureObject.markModified('gff3FeatureLineWithRefs') // Mark as modified. Without this save() -method is not updating data in database
    await featureObject.save().catch((error: unknown) => {
      throw new InternalServerErrorException(error)
    })
    this.logger.debug(`Object updated in Mongo`)
    this.logger.verbose(`Updated whole object ${JSON.stringify(featureObject)}`)
  }
}
