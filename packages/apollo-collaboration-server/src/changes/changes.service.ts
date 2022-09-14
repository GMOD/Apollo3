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
  CoreValidation,
  ParentChildValidation,
  SerializedChange,
  ValidationSet,
  changeRegistry,
  changes,
} from 'apollo-shared'
import { FilterQuery, Model } from 'mongoose'

import { FilesService } from '../files/files.service'
import { MessagesGateway } from '../messages/messages.gateway'
import { CreateChangeDto } from './dto/create-change.dto'
import { FindChangeDto } from './dto/find-change.dto'

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
    private readonly messagesGateway: MessagesGateway,
  ) {
    Object.entries(changes).forEach(([changeName, change]) => {
      changeRegistry.registerChange(changeName, change)
    })
  }

  private readonly logger = new Logger(ChangesService.name)
  private readonly validations = new ValidationSet([
    new CoreValidation(),
    new ParentChildValidation(),
  ])

  async create(serializedChange: SerializedChange, userName: string) {
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
    let changeDoc: ChangeDocument | undefined
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
      changeDoc = savedChangedLogDoc
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
    this.logger.debug(`ChangeDocId: ${changeDoc?._id}`)
    // Broadcast
    const broadcastChanges: Array<string> = [
      'CopyFeatureChange',
      'DeleteFeatureChange',
      'LocationEndChange',
      'LocationStartChange',
    ]
    if (broadcastChanges.includes(change.typeName as unknown as string)) {
      let channel
      // Get refName based on featureId
      const tmpObject: any = {
        ...serializedChange,
      }
      if (tmpObject.hasOwnProperty('featureId')) {
        const { featureId } = tmpObject
        this.logger.debug(`FeatureId: ${featureId}`)

        // Search correct feature
        const topLevelFeature = await this.featureModel
          .findOne({ allIds: featureId })
          .exec()
        if (!topLevelFeature) {
          const errMsg = `*** ERROR: The following featureId was not found in database ='${featureId}'`
          this.logger.error(errMsg)
          throw new Error(errMsg)
        }
        this.logger.debug?.(`RefName: ${topLevelFeature.refSeq}`)
        const msg = {
          changeInfo: serializedChange,
          refName: topLevelFeature.refSeq,
          userName,
        }

        // In case of 'CopyFeatureChange' assemlblyId in channel is the target assemblyId
        if (change.typeName === 'CopyFeatureChange') {
          const { targetAssemblyId } = tmpObject
          channel = `${targetAssemblyId}-${topLevelFeature.refSeq}`
        } else {
          channel = `${change.assemblyId}-${topLevelFeature.refSeq}`
        }
        this.logger.debug(`Broadcasting to channel '${channel}'`)
        await this.messagesGateway.create(channel, msg)
      }
    }

    return changeDoc
  }

  async findAll(changeFilter: FindChangeDto) {
    const queryCond: FilterQuery<ChangeDocument> = { ...changeFilter }
    if (changeFilter.user) {
      queryCond.user = {
        $regex: `${changeFilter.user}`,
        $options: 'i',
      }
    }
    this.logger.debug(`Search criteria: "${JSON.stringify(queryCond)}"`)

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
