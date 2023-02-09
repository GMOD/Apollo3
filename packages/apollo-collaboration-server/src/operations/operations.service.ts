import { Injectable, Logger } from '@nestjs/common'
import { InjectConnection, InjectModel } from '@nestjs/mongoose'
import {
  Operation,
  SerializedOperation,
  operationRegistry,
} from 'apollo-common'
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
  User,
  UserDocument,
} from 'apollo-schemas'
import { Connection, Model } from 'mongoose'

import { CountersService } from '../counters/counters.service'
import { FilesService } from '../files/files.service'
import { OntologiesService } from '../ontologies/ontologies.service'
import { PluginsService } from '../plugins/plugins.service'

@Injectable()
export class OperationsService {
  constructor(
    @InjectModel(Assembly.name)
    private readonly assemblyModel: Model<AssemblyDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
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
    private readonly ontologiesService: OntologiesService,
  ) {}

  private readonly logger = new Logger(OperationsService.name)

  async executeOperation<T extends Operation>(
    serializedOperation: SerializedOperation,
  ): Promise<ReturnType<T['executeOnServer']>> {
    const { logger } = this
    const OperationType = operationRegistry.getOperationType(
      serializedOperation.typeName,
    )
    const operation = new OperationType(serializedOperation, { logger })
    const session = await this.connection.startSession()
    const result = await operation.execute({
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
      user: '',
    })
    session.endSession()
    return result
  }
}
