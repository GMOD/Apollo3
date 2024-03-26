import { Operation, operationRegistry } from '@apollo-annotation/common'
import {
  Assembly,
  AssemblyDocument,
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
import { Injectable, Logger } from '@nestjs/common'
import { InjectConnection, InjectModel } from '@nestjs/mongoose'
import { Connection, Model } from 'mongoose'

import { CountersService } from '../counters/counters.service'
import { FilesService } from '../files/files.service'
import { PluginsService } from '../plugins/plugins.service'

@Injectable()
export class OperationsService {
  constructor(
    @InjectModel(Assembly.name)
    private readonly assemblyModel: Model<AssemblyDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    @InjectModel(Track.name)
    private readonly trackModel: Model<TrackDocument>,
    @InjectModel(Feature.name)
    private readonly featureModel: Model<FeatureDocument>,
    @InjectModel(File.name)
    private readonly fileModel: Model<FileDocument>,
    @InjectModel(RefSeq.name)
    private readonly refSeqModel: Model<RefSeqDocument>,
    @InjectModel(RefSeqChunk.name)
    private readonly refSeqChunkModel: Model<RefSeqChunkDocument>,
    private readonly filesService: FilesService,
    private readonly countersService: CountersService,
    private readonly pluginsService: PluginsService,
    @InjectConnection() private connection: Connection,
  ) {}

  private readonly logger = new Logger(OperationsService.name)

  async executeOperation<T extends Operation>(
    serializedOperation: ReturnType<T['toJSON']>,
  ): Promise<ReturnType<T['executeOnServer']>> {
    const {
      assemblyModel,
      connection,
      countersService,
      featureModel,
      fileModel,
      filesService,
      logger,
      pluginsService,
      refSeqChunkModel,
      refSeqModel,
      trackModel,
      userModel,
    } = this
    const OperationType = operationRegistry.getOperationType(
      serializedOperation.typeName,
    )
    const operation = new OperationType(serializedOperation, { logger })
    const session = await connection.startSession()
    const result = (await operation.execute({
      typeName: 'Server',
      featureModel,
      assemblyModel,
      refSeqModel,
      refSeqChunkModel,
      fileModel,
      userModel,
      trackModel,
      session,
      filesService,
      counterService: countersService,
      pluginsService,
      user: '',
    })) as ReturnType<T['executeOnServer']>
    await session.endSession()
    return result
  }
}
