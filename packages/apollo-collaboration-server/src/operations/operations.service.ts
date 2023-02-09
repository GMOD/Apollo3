import { Inject, Injectable, Logger, forwardRef } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
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
import {
  Operation,
  SerializedOperationParentType,
  operationRegistry,
} from 'apollo-shared'
import { Model } from 'mongoose'

import { CountersService } from '../counters/counters.service'
import { FilesService } from '../files/files.service'
import { OntologiesService } from '../ontologies/ontologies.service'

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
    @Inject(forwardRef(() => OntologiesService))
    private readonly ontologiesService: OntologiesService,
  ) {}

  private readonly logger = new Logger(OperationsService.name)

  async executeOperation<T extends Operation>(
    serializedOperation: SerializedOperationParentType,
  ): Promise<ReturnType<T['executeOnServer']>> {
    const OperationType = operationRegistry.getOperationType(
      serializedOperation.typeName,
    )
    const operation = new OperationType(serializedOperation)
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    return operation.execute({
      typeName: 'Server',
      featureModel: this.featureModel,
      assemblyModel: this.assemblyModel,
      refSeqModel: this.refSeqModel,
      refSeqChunkModel: this.refSeqChunkModel,
      fileModel: this.fileModel,
      userModel: this.userModel,
      // session: await startSession(),
      filesService: this.filesService,
      counterService: this.countersService,
      ontologyService: this.ontologiesService,
      parentType: serializedOperation.parentType,
      user: '',
    })
  }
}
