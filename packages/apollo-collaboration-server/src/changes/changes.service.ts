import {
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import {
  AssemblySpecificChange,
  Change as BaseChange,
  FeatureChange,
} from 'apollo-common'
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
  CopyFeatureChange,
  DecodedJWT,
  makeUserSessionId,
  validationRegistry,
} from 'apollo-shared'
import { FilterQuery, Model } from 'mongoose'

import { CountersService } from '../counters/counters.service'
import { FilesService } from '../files/files.service'
import { ChangeMessage } from '../messages/entities/message.entity'
import { MessagesGateway } from '../messages/messages.gateway'
import { OntologiesService } from '../ontologies/ontologies.service'
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
    @InjectModel(Change.name)
    private readonly changeModel: Model<ChangeDocument>,
    private readonly filesService: FilesService,
    private readonly countersService: CountersService,
    private readonly pluginsService: PluginsService,
    private readonly messagesGateway: MessagesGateway,
    private readonly ontologiesService: OntologiesService,
  ) {}

  private readonly logger = new Logger(ChangesService.name)

  async create(change: BaseChange, user: DecodedJWT) {
    this.logger.debug(`Requested change: ${JSON.stringify(change)}`)

    const sequence = await this.countersService.getNextSequenceValue(
      'changeCounter',
    )
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
        await change.execute({
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
          pluginsService: this.pluginsService,
          ontologyService: this.ontologiesService,
          parentType: '',
          user: uniqUserId,
        })
      } catch (e) {
        // Clean up old "temporary document" -documents
        // We cannot use Mongo 'session' / transaction here because Mongo has 16 MB limit for transaction
        this.logger.debug(
          `*** INSERT DATA EXCEPTION - Start to clean up old temporary documents...`,
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
        throw new UnprocessableEntityException(String(e))
      }

      // Add entry to change collection
      const [savedChangedLogDoc] = await this.changeModel.create([
        {
          ...change,
          user: user.email,
          sequence,
        },
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
    await this.featureModel.db.transaction(async (session) => {
      this.logger.debug(
        `Updates "temporary document" -status --> "valid" -status`,
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
      } catch (e) {
        // Clean up old "temporary document" -documents
        this.logger.debug(
          `*** UPDATE STATUS EXCEPTION - Start to clean up old temporary documents...`,
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
        throw new UnprocessableEntityException(String(e))
      }
    })

    this.logger.debug?.(`CHANGE DOC: ${JSON.stringify(changeDoc)}`)
    if (!changeDoc) {
      throw new UnprocessableEntityException('could not create change')
    }
    this.logger.debug(`TypeName: ${change.typeName}`)

    if (!(change instanceof AssemblySpecificChange)) {
      return
    }

    // Broadcast
    const messages: ChangeMessage[] = []

    const userSessionId = makeUserSessionId(user)
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
          userName: user.username,
          userSessionId,
          channel: `${targetAssemblyId}-${refName}`,
          changeSequence: changeDoc.sequence,
        })
      }
    } else if (change instanceof FeatureChange) {
      for (const refName of refNames) {
        messages.push({
          changeInfo: change.toJSON(),
          userName: user.username,
          userSessionId,
          channel: `${change.assembly}-${refName}`,
          changeSequence: changeDoc.sequence,
        })
      }
    } else {
      messages.push({
        changeInfo: change.toJSON(),
        userName: user.username,
        userSessionId,
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
