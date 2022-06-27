import fs from 'fs'

import { Logger, UnprocessableEntityException } from '@nestjs/common'
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
  CoreValidation,
  LocationEndChange,
  LocationStartChange,
  SerializedChange,
  TypeChange,
  ValidationSet,
  changeRegistry,
} from 'apollo-shared'
import { Model } from 'mongoose'

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
  private readonly validations = new ValidationSet([new CoreValidation()])

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
          fs,
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
        this.featureModel,
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
}
