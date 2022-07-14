import {
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import {
  Assembly,
  AssemblyDocument,
  Change,
  ChangeDocument,
  Feature,
  FeatureDocument,
  File,
  FileDocument,
  RefSeq,
  RefSeqChunk,
  RefSeqChunkDocument,
  RefSeqDocument,
} from 'apollo-schemas'
import {
  AddAssemblyAndFeaturesFromFileChange,
  AddAssemblyFromFileChange,
  AddFeaturesFromFileChange,
  ChangeFilter,
  CoreValidation,
  LocationEndChange,
  LocationStartChange,
  ParentChildValidation,
  SerializedChange,
  TypeChange,
  ValidationSet,
  changeRegistry,
} from 'apollo-shared'
import { Model } from 'mongoose'

import { FilesService } from '../files/files.service'
import { CreateChangeDto } from './dto/create-change.dto'

export class ChangesService {
  constructor(
    @InjectModel(Feature.name)
    private readonly featureModel: Model<FeatureDocument>,
    @InjectModel(Assembly.name)
    private readonly assemblyModel: Model<AssemblyDocument>,
    @InjectModel(RefSeq.name)
    private readonly refSeqModel: Model<RefSeqDocument>,
    @InjectModel(RefSeqChunk.name)
    private readonly refSeqChunkModel: Model<RefSeqChunkDocument>,
    @InjectModel(File.name)
    private readonly fileModel: Model<FileDocument>,
    @InjectModel(Change.name)
    private readonly changeModel: Model<ChangeDocument>,
    private readonly filesService: FilesService,
  ) {
    changeRegistry.registerChange(
      'AddAssemblyAndFeaturesFromFileChange',
      AddAssemblyAndFeaturesFromFileChange,
    )
    changeRegistry.registerChange(
      'AddAssemblyFromFileChange',
      AddAssemblyFromFileChange,
    )
    changeRegistry.registerChange(
      'AddFeaturesFromFileChange',
      AddFeaturesFromFileChange,
    )
    changeRegistry.registerChange('LocationEndChange', LocationEndChange)
    changeRegistry.registerChange('LocationStartChange', LocationStartChange)
    changeRegistry.registerChange('TypeChange', TypeChange)
  }

  private readonly logger = new Logger(ChangesService.name)
  private readonly validations = new ValidationSet([
    new CoreValidation(),
    new ParentChildValidation(),
  ])

  async submitChange(serializedChange: SerializedChange) {
    const ChangeType = changeRegistry.getChangeType(serializedChange.typeName)
    const change = new ChangeType(serializedChange, { logger: this.logger })
    this.logger.debug(`Requested change: ${JSON.stringify(change)}`)

    const validationResult = await this.validations.backendPreValidate(change)
    if (!validationResult.ok) {
      const errorMessage = validationResult.results
        .map((r) => r.error?.message)
        .filter(Boolean)
        .join(', ')
      throw new UnprocessableEntityException(
        `Error in backend pre-validation: ${errorMessage}`,
      )
    }

    let changeDocId
    await this.featureModel.db.transaction(async (session) => {
      try {
        await change.apply({
          typeName: 'Server',
          featureModel: this.featureModel,
          assemblyModel: this.assemblyModel,
          refSeqModel: this.refSeqModel,
          refSeqChunkModel: this.refSeqChunkModel,
          fileModel: this.fileModel,
          session,
          filesService: this.filesService,
        })
      } catch (e) {
        throw new UnprocessableEntityException(String(e))
      }

      // Add change information to change -collection
      this.logger.debug(`ChangeIds: ${change.changedIds}`)
      this.logger.debug(`AssemblyId: ${change.assemblyId}`)

      // Add entry to change collection
      const changeEntry: CreateChangeDto = {
        assembly: change.assemblyId,
        ...change,
        user: 'demo user id',
      }
      const [savedChangedLogDoc] = await this.changeModel.create(
        [changeEntry],
        { session },
      )
      changeDocId = savedChangedLogDoc._id
      const validationResult2 = await this.validations.backendPostValidate(
        change,
        { featureModel: this.featureModel, session },
      )
      if (!validationResult2.ok) {
        const errorMessage = validationResult2.results
          .map((r) => r.error?.message)
          .filter(Boolean)
          .join(', ')
        throw new UnprocessableEntityException(
          `Error in backend post-validation: ${errorMessage}`,
        )
      }
    })
    this.logger.debug(`ChangeDocId: ${changeDocId}`)
    return { change: changeDocId }
  }

  async findChange(changeFilter: ChangeFilter) {
    // Search correct feature
    const queryCond: any = {}
    if (changeFilter.assemblyId) {
      queryCond.assembly = changeFilter.assemblyId
    }
    if (changeFilter.typeName) {
      queryCond.typeName = changeFilter.typeName
    }
    if (changeFilter.userName) {
      queryCond.user = { $regex: `${changeFilter.userName}`, $options: 'i' }
    }
    this.logger.debug(`Search criteria: "${JSON.stringify(queryCond)}"`)

    // // ********** BEGIN  ******* JOIN COLLECTION TEST **************
    // const change2 = await this.changeModel
    //   .aggregate([
    //     // { $match: { "assembly": new mongoose.Types.ObjectId('62c5c9d433d0d0b97ef20028')} }, *** WORKS FINE ***
    //     {
    //       $match: {
    //         assembly: new mongoose.Types.ObjectId('62c5c9d433d0d0b97ef20028'),
    //         typeName: 'LocationEndChange',
    //       },
    //     }, //* ** WORKS FINE ***
    //     // { $match: { "assembly": new mongoose.Types.ObjectId('62c5c9d433d0d0b97ef20028'), "typeName":""} },  *** NO DATA FOUND ***
    //     {
    //       $lookup: {
    //         localField: 'assembly',
    //         from: 'assemblies',
    //         foreignField: '_id',
    //         as: 'assemblyName',
    //       },
    //     },
    //   ])
    //   .exec()
    // this.logger.debug(
    //   `******************* CHANGE: "${JSON.stringify(change2)}"`,
    // )
    // return change2
    // //* **** END  ******* JOIN COLLECTION TEST **************

    const change = await this.changeModel
      .find(queryCond)
      .sort({ createdAt: -1 })
      .exec()

    if (!change) {
      const errMsg = `ERROR: The following change was not found in database....`
      this.logger.error(errMsg)
      throw new NotFoundException(errMsg)
    }

    return change
  }
}
