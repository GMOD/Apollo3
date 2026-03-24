/* eslint-disable @typescript-eslint/no-unnecessary-condition */
import {
  Change as BaseChange,
  isAssemblySpecificChange,
  isFeatureChange,
} from '@apollo-annotation/common'
import {
  Assembly,
  type AssemblyDocument,
  Change,
  type ChangeDocument,
  Feature,
  type FeatureDocument,
  RefSeq,
  RefSeqChunk,
  type RefSeqChunkDocument,
  type RefSeqDocument,
} from '@apollo-annotation/schemas'
import {
  AddFeatureChange,
  type AddFeatureChangeDetails,
  type ChangeMessage,
  type DecodedJWT,
  changes,
  makeUserSessionId,
  validationRegistry,
} from '@apollo-annotation/shared'
import {
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { type FilterQuery, Model, Types } from 'mongoose'

import { CountersService } from '../counters/counters.service.js'
import { MessagesGateway } from '../messages/messages.gateway.js'

import { ChangeHandlersService } from './changeHandlers.service.js'
import { FindChangeDto } from './dto/find-change.dto.js'

const STATUS_ZERO_CHANGE_TYPES = new Set([
  'AddAssemblyAndFeaturesFromFileChange',
  'AddAssemblyFromExternalChange',
  'AddAssemblyFromFileChange',
  'AddFeaturesFromFileChange',
])
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
    @InjectModel(Change.name)
    private readonly changeModel: Model<ChangeDocument>,
    private readonly countersService: CountersService,
    private readonly messagesGateway: MessagesGateway,
    private readonly changeHandlersService: ChangeHandlersService,
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
        const handler =
          this.changeHandlersService[change.typeName as keyof typeof changes]
        // @ts-expect-error change not narrowed
        await handler(change, { session, user: uniqUserId })
      } catch (error) {
        // Clean up old "temporary document" -documents
        // We cannot use Mongo 'session' / transaction here because Mongo has 16 MB limit for transaction
        this.logger.debug(
          '*** INSERT DATA EXCEPTION - Start to clean up old temporary documents...',
        )
        await this.assemblyModel
          .deleteMany({ $and: [{ status: -1, user: uniqUserId }] })
          .exec()
        await this.featureModel
          .deleteMany({ $and: [{ status: -1, user: uniqUserId }] })
          .exec()
        await this.refSeqModel
          .deleteMany({ $and: [{ status: -1, user: uniqUserId }] })
          .exec()
        await this.refSeqChunkModel
          .deleteMany({ $and: [{ status: -1, user: uniqUserId }] })
          .exec()
        throw new UnprocessableEntityException(String(error))
      }

      // Add entry to change collection
      const [savedChangedLogDoc] = await this.changeModel.create([
        // eslint-disable-next-line @typescript-eslint/no-misused-spread
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

    // TODO: temporary solution to set status of add feature change to 0
    if (change.typeName === 'AddFeatureChange') {
      const addFeatureChange = change as AddFeatureChange
      const addFeatureChangeDetails: AddFeatureChangeDetails[] =
        addFeatureChange.changes
      for (const addFeatureChangeDetail of addFeatureChangeDetails) {
        const { addedFeature } = addFeatureChangeDetail

        await this.featureModel.db.transaction(async () => {
          try {
            await this.featureModel
              .updateMany(
                {
                  $and: [
                    { status: -1, user: uniqUserId, _id: addedFeature._id },
                  ],
                },
                { $set: { status: 0 } },
              )
              .exec()
          } catch (error) {
            const err = error as Error
            this.logger.error(
              `Error setting status of add feature change to 0: ${err.message}`,
            )
            await this.featureModel
              .deleteMany({
                $and: [{ status: -1, user: uniqUserId, _id: addedFeature._id }],
              })
              .exec()
          }
        })
      }
    }

    if (STATUS_ZERO_CHANGE_TYPES.has(change.typeName)) {
      // manual finalization of change since the data is too big for a transaction
      this.logger.debug('*** TEMPORARY DATA INSERTED ***')
      // Set "temporary document" -status --> "valid" -status i.e. (-1 --> 0)
      await this.featureModel.db.transaction(async () => {
        try {
          await this.batchUpdateMany(this.assemblyModel, uniqUserId)
          await this.batchUpdateMany(this.refSeqChunkModel, uniqUserId)
          await this.batchUpdateMany(this.featureModel, uniqUserId)
          await this.batchUpdateMany(this.refSeqModel, uniqUserId)
        } catch (error) {
          // Clean up old "temporary document" -documents
          this.logger.debug(
            '*** UPDATE STATUS EXCEPTION - Start to clean up old temporary documents...',
          )
          await this.assemblyModel
            .deleteMany({ $and: [{ status: -1, user: uniqUserId }] })
            .exec()
          await this.featureModel
            .deleteMany({ $and: [{ status: -1, user: uniqUserId }] })
            .exec()
          await this.refSeqModel
            .deleteMany({ $and: [{ status: -1, user: uniqUserId }] })
            .exec()
          await this.refSeqChunkModel
            .deleteMany({ $and: [{ status: -1, user: uniqUserId }] })
            .exec()
          if (error instanceof Error) {
            throw error
          }
          throw new UnprocessableEntityException(String(error))
        }
      })
    }

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
    if (isFeatureChange(change)) {
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
      await this.messagesGateway.create(message.channel, message)
    }
    this.logger.debug(`ChangeDocId: ${changeDoc?._id.toString()}`)
    return changeDoc
  }

  async findAll(changeFilter: FindChangeDto) {
    // eslint-disable-next-line @typescript-eslint/no-misused-spread
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

  async batchUpdateMany(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    model: Model<any>,
    uniqUserId: string,
  ) {
    let docsToUpdate = await model
      .find({ $and: [{ status: -1, user: uniqUserId }] })
      .limit(1000)
      .exec()
    let updatedCount = 0
    while (docsToUpdate.length > 0) {
      const lengthBefore = updatedCount
      updatedCount += docsToUpdate.length
      this.logger.debug(
        `Finalizing ${model.collection.name} ${lengthBefore} to ${updatedCount}`,
      )
      const idsToUpdate = docsToUpdate.map(
        (doc) => (doc as { _id: Types.ObjectId })._id,
      )
      await model
        .updateMany({ _id: idsToUpdate }, { $set: { status: 0 } })
        .exec()
      docsToUpdate = await model
        .find({ $and: [{ status: -1, user: uniqUserId }] })
        .limit(1000)
        .exec()
    }
  }
}
