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
  User,
  UserDocument,
} from 'apollo-schemas'
import {
  AddFeatureChange,
  AssemblySpecificChange,
  Change as BaseChange,
  CopyFeatureChange,
  FeatureChange,
  validationRegistry,
} from 'apollo-shared'
import { FilterQuery, Model } from 'mongoose'

import { CountersService } from '../counters/counters.service'
import { FilesService } from '../files/files.service'
import { Message } from '../messages/entities/message.entity'
import { MessagesGateway } from '../messages/messages.gateway'
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
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    @InjectModel(Change.name)
    private readonly changeModel: Model<ChangeDocument>,
    private readonly filesService: FilesService,
    private readonly countersService: CountersService,
    private readonly messagesGateway: MessagesGateway,
  ) {}

  private readonly logger = new Logger(ChangesService.name)

  async create(change: BaseChange, user: string, userToken: string) {
    this.logger.debug(`Requested change: ${JSON.stringify(change)}`)
    const validationResult = await validationRegistry.backendPreValidate(
      change,
      { userModel: this.userModel },
    )
    if (!validationResult.ok) {
      const errorMessage = validationResult.resultsMessages
      throw new UnprocessableEntityException(
        `Error in backend pre-validation: ${errorMessage}`,
      )
    }
    // Get some info for later broadcasting, before any features are potentially
    // deleted
    const refNames: string[] = []
    if (change instanceof FeatureChange) {
      // For broadcasting we need also refName
      const { changedIds } = change
      for (const changedId of changedIds) {
        const featureDoc = await this.featureModel
          .findOne({ allIds: changedId })
          .exec()
        if (featureDoc) {
          const refSeqDoc = await this.refSeqModel
            .findById(featureDoc.refSeq)
            .exec()
          if (refSeqDoc) {
            refNames.push(refSeqDoc.name)
          }
        }
      }
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
          userModel: this.userModel,
          session,
          filesService: this.filesService,
          counterService: this.countersService,
        })
      } catch (e) {
        throw new UnprocessableEntityException(String(e))
      }

      // Add entry to change collection
      const [savedChangedLogDoc] = await this.changeModel.create(
        [
          {
            ...change,
            user,
            sequence: await this.countersService.getNextSequenceValue(
              'changeCounter',
            ),
          },
        ],
        // { session },
      )
      changeDoc = savedChangedLogDoc
      const validationResult2 = await validationRegistry.backendPostValidate(
        change,
        { featureModel: this.featureModel, session },
      )
      if (!validationResult2.ok) {
        const errorMessage = validationResult2.resultsMessages
        throw new UnprocessableEntityException(
          `Error in backend post-validation: ${errorMessage}`,
        )
      }
    })
    // Set "temporary document" -status --> "valid" -status in transaction
    await this.featureModel.db.transaction(async (session) => {
      this.logger.debug(`UPDATE STATUSES STARTS...`)
      try {
        await this.assemblyModel.updateMany(
          { status: -1 },
          { $set: { status: 0 } },
          { session },
        )
        await this.featureModel.updateMany(
          { status: -1 },
          { $set: { status: 0 } },
          { session },
        )
        await this.refSeqModel.updateMany(
          { status: -1 },
          { $set: { status: 0 } },
          { session },
        )
        await this.refSeqChunkModel.updateMany(
          { status: -1 },
          { $set: { status: 0 } },
          { session },
        )
        this.logger.debug(`UPDATE STATUSES ENDED`)
      } catch (e) {
        throw new UnprocessableEntityException(String(e))
      }
    })

    if (!changeDoc) {
      throw new UnprocessableEntityException('could not create change')
    }
    this.logger.debug(`TypeName: ${change.typeName}`)

    if (!(change instanceof AssemblySpecificChange)) {
      return
    }

    // Broadcast
    const messages: Message[] = []

    // In case of 'CopyFeatureChange', we need to create 'AddFeatureChange' to all connected clients
    if (change instanceof CopyFeatureChange) {
      const [{ targetAssemblyId, newFeatureId }] = change.changes
      // Get origin top level feature
      const topLevelFeature = await this.featureModel
        .findOne({ allIds: newFeatureId })
        .exec()
      if (!topLevelFeature) {
        const errMsg = `*** ERROR: The following featureId was not found in database ='${newFeatureId}'`
        this.logger.error?.(errMsg)
        throw new Error(errMsg)
      }
      const newChange = new AddFeatureChange({
        typeName: 'AddFeatureChange',
        assembly: targetAssemblyId,
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        addedFeature: topLevelFeature,
      })
      for (const refName of refNames) {
        messages.push({
          changeInfo: newChange.toJSON(),
          userName: user,
          userToken,
          channel: `${targetAssemblyId}-${refName}`,
          changeSequence: changeDoc.sequence,
        })
      }
    } else if (change instanceof FeatureChange) {
      for (const refName of refNames) {
        messages.push({
          changeInfo: change.toJSON(),
          userName: user,
          userToken,
          channel: `${change.assembly}-${refName}`,
          changeSequence: changeDoc.sequence,
        })
      }
    } else {
      messages.push({
        changeInfo: change.toJSON(),
        userName: user,
        userToken,
        channel: 'COMMON',
        changeSequence: changeDoc.sequence,
      })
    }

    for (const message of messages) {
      this.logger.debug(
        `Broadcasting to channels '${
          message.channel
        }', changeObject: "${JSON.stringify(message)}"`,
      )
      this.messagesGateway.create(message.channel, message)
    }
    this.logger.debug(`ChangeDocId: ${changeDoc?._id}`)
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
    if (changeFilter.since) {
      queryCond.sequence = { $gt: Number(changeFilter.since) }
      delete queryCond.since
    }
    this.logger.debug(`Search criteria: "${JSON.stringify(queryCond)}"`)

    let sortOrder: 1 | -1 = -1
    if (changeFilter.sort) {
      if (changeFilter.sort === '1') {
        sortOrder = 1
      }
    }
    let changeCursor = this.changeModel
      .find(queryCond)
      .sort({ sequence: sortOrder })

    if (changeFilter.limit) {
      changeCursor = changeCursor.limit(Number(changeFilter.limit))
    }
    const change = await changeCursor.exec()

    if (!change) {
      const errMsg = `ERROR: The following change was not found in database....`
      this.logger.error(errMsg)
      throw new NotFoundException(errMsg)
    }

    return change
  }
}
