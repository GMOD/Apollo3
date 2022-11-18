import type { ReadStream } from 'fs'
import type { FileHandle } from 'fs/promises'

import type { LoggerService } from '@nestjs/common'
import {
  AssemblyDocument,
  FeatureDocument,
  FileDocument,
  RefSeqChunkDocument,
  RefSeqDocument,
  UserDocument,
} from 'apollo-schemas'
import type { ClientSession, Model } from 'mongoose'

import { operationRegistry } from '..'

export interface LocalGFF3DataStore {
  typeName: 'LocalGFF3'
  gff3Handle: FileHandle
}

interface CreateFileDto {
  readonly _id: string
  readonly basename: string
  readonly checksum: string
  readonly type: 'text/x-gff3' | 'text/x-fasta'
  readonly user: string
}

export interface ServerDataStore {
  typeName: 'Server'
  featureModel: Model<FeatureDocument>
  assemblyModel: Model<AssemblyDocument>
  refSeqModel: Model<RefSeqDocument>
  refSeqChunkModel: Model<RefSeqChunkDocument>
  fileModel: Model<FileDocument>
  userModel: Model<UserDocument>
  session: ClientSession
  filesService: {
    getFileStream(file: FileDocument): ReadStream
    parseGFF3(stream: ReadStream): ReadStream
    create(createFileDto: CreateFileDto): void
    remove(id: string): void
  }
  counterService: {
    getNextSequenceValue(sequenceName: string): Promise<number>
  }
  user: string
}

export interface SerializedOperation {
  typeName: string
}

export type BackendDataStore = ServerDataStore | LocalGFF3DataStore

export interface OperationOptions {
  logger: LoggerService
}

export abstract class Operation implements SerializedOperation {
  protected logger: LoggerService
  abstract typeName: string

  constructor(json: SerializedOperation, options?: OperationOptions) {
    this.logger = options?.logger || console
  }

  static fromJSON(
    json: SerializedOperation,
    options?: OperationOptions,
  ): Operation {
    const OperationType = operationRegistry.getOperationType(json.typeName)
    return new OperationType(
      json,
      options?.logger && { logger: options.logger },
    )
  }

  abstract toJSON(): SerializedOperation

  async execute(backend: BackendDataStore): Promise<void> {
    const backendType = backend.typeName
    if (backendType === 'Server') {
      return this.executeOnServer(backend)
    }
    if (backendType === 'LocalGFF3') {
      return this.executeOnLocalGFF3(backend)
    }
    throw new Error(
      `no operation implementation for backend type '${backendType}'`,
    )
  }

  abstract executeOnServer(backend: ServerDataStore): Promise<void>
  abstract executeOnLocalGFF3(backend: LocalGFF3DataStore): Promise<void>
}
