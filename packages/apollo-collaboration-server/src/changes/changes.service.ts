import {
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { AnnotationFeatureSnapshot } from 'apollo-mst'
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
import { Change as BaseChange, validationRegistry } from 'apollo-shared'
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
    let changeDoc: ChangeDocument | undefined
    let featureId
    let refSeqId
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let tmpObject: any

    const assemblySpecificChange =
      change.typeName === 'AddAssemblyFromFileChange' ||
      change.typeName === 'AddAssemblyAndFeaturesFromFileChange' ||
      change.typeName === 'DeleteAssemblyChange'
        ? true
        : false

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
        { session },
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
      this.logger.debug(`TypeName: ${change.typeName}`)

      // Broadcast feature specific changes
      if (!assemblySpecificChange) {
        // For broadcasting we need also refName
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const tmpObject1: any = {
          ...change,
        }
        tmpObject = {
          ...tmpObject1.changes[0], // Should we loop all changes or is there just one change?
        }
        this.logger.debug(
          `Individual change object: ${JSON.stringify(tmpObject)}`,
        )

        if (
          tmpObject.hasOwnProperty('featureId') ||
          tmpObject.hasOwnProperty('deletedFeature') ||
          tmpObject.hasOwnProperty('newFeatureId') ||
          tmpObject.hasOwnProperty('addedFeature')
        ) {
          if (tmpObject.hasOwnProperty('deletedFeature')) {
            featureId = tmpObject.deletedFeature._id
          } else if (tmpObject.hasOwnProperty('addedFeature')) {
            featureId = tmpObject.addedFeature._id
          } else {
            // eslint-disable-next-line prefer-destructuring
            featureId = tmpObject.featureId
          }
          // Search correct feature
          const topLevelFeature = await this.featureModel
            .findOne({ allIds: featureId })
            .session(session)
            .exec()
          if (!topLevelFeature) {
            const errMsg = `*** ERROR: The following featureId was not found in database ='${featureId}'`
            this.logger.error(errMsg)
            throw new Error(errMsg)
          }
          refSeqId = topLevelFeature.refSeq
        }
      }
    })
    this.logger.debug(`ChangeDocId: ${changeDoc?._id}`)

    // Broadcast
    const broadcastChanges: string[] = [
      'AddAssemblyFromFileChange',
      'AddAssemblyAndFeaturesFromFileChange',
      'AddFeatureChange',
      'CopyFeatureChange',
      'DeleteAssemblyChange',
      'DeleteFeatureChange',
      'LocationEndChange',
      'LocationStartChange',
    ]
    if (broadcastChanges.includes(change.typeName as unknown as string)) {
      let channel
      let refDoc
      if (!assemblySpecificChange) {
        // Get feature's refSeqName
        refDoc = await this.refSeqModel.findById(refSeqId).exec()
        if (!refDoc) {
          const errMsg = `*** ERROR: The following refSeq was not found in database ='${refSeqId}'`
          this.logger.error(errMsg)
          throw new Error(errMsg)
        }
      }

      let msg: Message
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const changeSequence = changeDoc!.sequence

      // In case of 'CopyFeatureChange', we need to create 'AddFeatureChange' to all connected clients
      if (change.typeName === 'CopyFeatureChange') {
        const { targetAssemblyId } = tmpObject
        // Get origin top level feature
        const topLevelFeature = await this.featureModel
          .findOne({ allIds: tmpObject.newFeatureId })
          .exec()
        if (!topLevelFeature) {
          const errMsg = `*** ERROR: The following featureId was not found in database ='${tmpObject.newFeatureId}'`
          this.logger.error?.(errMsg)
          throw new Error(errMsg)
        }
        tmpObject.typeName = 'AddFeatureChange'
        tmpObject.assembly = targetAssemblyId
        tmpObject.addedFeature = topLevelFeature
        channel = `${targetAssemblyId}-${refDoc?.name}`
        msg = {
          changeInfo: tmpObject,
          userName: user,
          userToken,
          channel,
          changeSequence,
        }
        // In case of AssemblySpecificChange we use 'COMMON' channel to broadcast to all connected clients
      } else if (assemblySpecificChange) {
        channel = 'COMMON'
        msg = {
          changeInfo: change,
          userName: user,
          userToken,
          channel,
          changeSequence,
        }
      } else {
        channel = `${tmpObject.assembly}-${refDoc?.name}`
        msg = {
          changeInfo: change,
          userName: user,
          userToken,
          channel,
          changeSequence,
        }
      }

      this.logger.debug(
        `Broadcasting to channel '${channel}', changeObject: "${JSON.stringify(
          msg,
        )}"`,
      )
      await this.messagesGateway.create(channel, msg)
    }
    return changeDoc
  }

  /**
   * Get children's feature ids
   * @param feature - parent feature
   * @returns
   */
  getChildFeatureIds(feature: Feature | AnnotationFeatureSnapshot): string[] {
    if (!feature.children) {
      return []
    }
    const featureIds = []
    const children =
      feature.children instanceof Map
        ? feature.children
        : new Map(Object.entries(feature.children))
    for (const [childFeatureId, childFeature] of children || new Map()) {
      featureIds.push(childFeatureId, ...this.getChildFeatureIds(childFeature))
    }
    return featureIds
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
