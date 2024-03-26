/* eslint-disable @typescript-eslint/no-unnecessary-condition */
import {
  Change as BaseChange,
  isAssemblySpecificChange,
  isFeatureChange,
} from '@apollo-annotation/common'
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
  Track,
  TrackDocument,
  User,
  UserDocument,
} from '@apollo-annotation/schemas'
import {
  ChangeMessage,
  DecodedJWT,
  makeUserSessionId,
  validationRegistry,
} from '@apollo-annotation/shared'
import {
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { FilterQuery, Model } from 'mongoose'

import { CountersService } from '../counters/counters.service'
import { FilesService } from '../files/files.service'
import { MessagesGateway } from '../messages/messages.gateway'
import { PluginsService } from '../plugins/plugins.service'
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
    @InjectModel(Track.name)
    private readonly trackModel: Model<TrackDocument>,
    @InjectModel(Change.name)
    private readonly changeModel: Model<ChangeDocument>,
    private readonly filesService: FilesService,
    private readonly countersService: CountersService,
    private readonly pluginsService: PluginsService,
    private readonly messagesGateway: MessagesGateway,
  ) {}

  private readonly logger = new Logger(ChangesService.name)

  async create(change: BaseChange, user: DecodedJWT) {
    this.logger.debug(`Requested change: ${JSON.stringify(change)}`)

    const sequence =
      await this.countersService.getNextSequenceValue('changeCounter')
    const uniqUserId = `${user.email}-${sequence}` // Same user can upload data from more than one client

    const validationResult = await validationRegistry.backendPreValidate(change)
    if (!validationResult.ok) {
      const errorMessage = validationResult.resultsMessages
      throw new UnprocessableEntityException(
        `Error in backend pre-validation: ${errorMessage}`,
      )
    }
    // Get some info for later broadcasting, before any features are potentially
    // deleted
    const refNames: string[] = []
    if (isFeatureChange(change)) {
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
        await change.execute({
          typeName: 'Server',
          featureModel: this.featureModel,
          assemblyModel: this.assemblyModel,
          refSeqModel: this.refSeqModel,
          refSeqChunkModel: this.refSeqChunkModel,
          fileModel: this.fileModel,
          userModel: this.userModel,
          trackModel: this.trackModel,
          session,
          filesService: this.filesService,
          counterService: this.countersService,
          pluginsService: this.pluginsService,
          user: uniqUserId,
        })
      } catch (error) {
        // Clean up old "temporary document" -documents
        // We cannot use Mongo 'session' / transaction here because Mongo has 16 MB limit for transaction
        this.logger.debug(
          '*** INSERT DATA EXCEPTION - Start to clean up old temporary documents...',
        )
        await this.assemblyModel.deleteMany({
          $and: [{ status: -1, user: uniqUserId }],
        })
        await this.featureModel.deleteMany({
          $and: [{ status: -1, user: uniqUserId }],
        })
        await this.refSeqModel.deleteMany({
          $and: [{ status: -1, user: uniqUserId }],
        })
        await this.refSeqChunkModel.deleteMany({
          $and: [{ status: -1, user: uniqUserId }],
        })
        throw new UnprocessableEntityException(String(error))
      }

      // Add entry to change collection
      const [savedChangedLogDoc] = await this.changeModel.create([
        { ...change, user: user.email, sequence },
      ])
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
    this.logger.debug?.('*** TEMPORARY DATA INSERTTED ***')
    // Set "temporary document" -status --> "valid" -status i.e. (-1 --> 0)
    await this.featureModel.db.transaction(async () => {
      this.logger.debug(
        'Updates "temporary document" -status --> "valid" -status',
      )
      try {
        // We cannot use Mongo 'session' / transaction here because Mongo has 16 MB limit for transaction
        await this.refSeqChunkModel.updateMany(
          { $and: [{ status: -1, user: uniqUserId }] },
          { $set: { status: 0 } },
        )
        await this.featureModel.updateMany(
          { $and: [{ status: -1, user: uniqUserId }] },
          { $set: { status: 0 } },
        )
        await this.assemblyModel.updateMany(
          { $and: [{ status: -1, user: uniqUserId }] },
          { $set: { status: 0 } },
        )
        await this.refSeqModel.updateMany(
          { $and: [{ status: -1, user: uniqUserId }] },
          { $set: { status: 0 } },
        )
      } catch (error) {
        // Clean up old "temporary document" -documents
        this.logger.debug(
          '*** UPDATE STATUS EXCEPTION - Start to clean up old temporary documents...',
        )
        // We cannot use Mongo 'session' / transaction here because Mongo has 16 MB limit for transaction
        await this.assemblyModel.deleteMany({
          $and: [{ status: -1, user: uniqUserId }],
        })
        await this.featureModel.deleteMany({
          $and: [{ status: -1, user: uniqUserId }],
        })
        await this.refSeqModel.deleteMany({
          $and: [{ status: -1, user: uniqUserId }],
        })
        await this.refSeqChunkModel.deleteMany({
          $and: [{ status: -1, user: uniqUserId }],
        })
        throw new UnprocessableEntityException(String(error))
      }
    })

    this.logger.debug?.(`CHANGE DOC: ${JSON.stringify(changeDoc)}`)
    if (!changeDoc) {
      throw new UnprocessableEntityException('could not create change')
    }
    this.logger.debug(`TypeName: ${change.typeName}`)

    if (!isAssemblySpecificChange(change)) {
      return
    }

    // Broadcast
    const messages: ChangeMessage[] = []

    const userSessionId = makeUserSessionId(user)
    messages.push({
      changeInfo: change.toJSON(),
      userName: user.username,
      userSessionId,
      channel: 'COMMON',
      changeSequence: changeDoc.sequence,
    })

    for (const message of messages) {
      this.logger.debug(
        `Broadcasting to channels '${
          message.channel
        }', changeObject: "${JSON.stringify(message)}"`,
      )
      await this.messagesGateway.create(message.channel, message)
    }
    this.logger.debug(`ChangeDocId: ${changeDoc?._id}`)
    return changeDoc
  }

  async findAll(changeFilter: FindChangeDto) {
    const queryCond: FilterQuery<ChangeDocument> = { ...changeFilter }
    if (changeFilter.user) {
      queryCond.user = { $regex: changeFilter.user, $options: 'i' }
    }
    if (changeFilter.since) {
      queryCond.sequence = { $gt: Number(changeFilter.since) }
      delete queryCond.since
    }
    this.logger.debug(`Search criteria: "${JSON.stringify(queryCond)}"`)

    let sortOrder: 1 | -1 = -1
    if (changeFilter.sort && changeFilter.sort === '1') {
      sortOrder = 1
    }
    let changeCursor = this.changeModel
      // unicorn thinks this is an Array.prototype.find, so we ignore it
      // eslint-disable-next-line unicorn/no-array-callback-reference
      .find(queryCond)
      .sort({ sequence: sortOrder })

    if (changeFilter.limit) {
      changeCursor = changeCursor.limit(Number(changeFilter.limit))
    }
    const change = await changeCursor.exec()

    if (!change) {
      const errMsg = 'ERROR: The following change was not found in database....'
      this.logger.error(errMsg)
      throw new NotFoundException(errMsg)
    }

    return change
  }
}
