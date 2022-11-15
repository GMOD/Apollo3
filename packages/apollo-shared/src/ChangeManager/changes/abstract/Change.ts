import type { ReadStream } from 'fs'
import type { FileHandle } from 'fs/promises'

import { Region } from '@jbrowse/core/util'
import { AppRootModel } from '@jbrowse/core/util'
import type { LoggerService } from '@nestjs/common'
import {
  AnnotationFeatureI,
  AnnotationFeatureSnapshot,
  ApolloAssemblyI,
} from 'apollo-mst'
import {
  AssemblyDocument,
  FeatureDocument,
  FileDocument,
  RefSeqChunkDocument,
  RefSeqDocument,
  UserDocument,
} from 'apollo-schemas'
import type { ClientSession, Model } from 'mongoose'

import { changeRegistry } from '../../ChangeTypes'

export interface ClientDataStore {
  typeName: 'Client'
  assemblies: Map<string, ApolloAssemblyI>
  internetAccounts: AppRootModel['internetAccounts']
  loadFeatures(regions: Region[]): void
  getFeature(featureId: string): AnnotationFeatureI | undefined
  addAssembly(_id: string, assemblyName: string): void
  addFeature(assemblyId: string, feature: AnnotationFeatureSnapshot): void
  deleteFeature(featureId: string): void
  deleteAssembly(assemblyId: string): void
}

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

export interface SerializedChange {
  typeName: string
}

export type DataStore = ServerDataStore | LocalGFF3DataStore | ClientDataStore

export interface ChangeOptions {
  logger: LoggerService
}

export abstract class Change implements SerializedChange {
  protected logger: LoggerService
  abstract typeName: string

  constructor(json: SerializedChange, options?: ChangeOptions) {
    this.logger = options?.logger || console
  }

  /**
   * If a non-empty string, a snackbar will display in JBrowse with this message
   * when a successful response is received from the server.
   */
  get notification() {
    return ''
  }

  static fromJSON(json: SerializedChange, options?: ChangeOptions): Change {
    const ChangeType = changeRegistry.getChangeType(json.typeName)
    return new ChangeType(json, options?.logger && { logger: options.logger })
  }

  abstract toJSON(): SerializedChange

  async apply(backend: DataStore): Promise<void> {
    const backendType = backend.typeName
    if (backendType === 'Server') {
      return this.applyToServer(backend)
    }
    if (backendType === 'LocalGFF3') {
      return this.applyToLocalGFF3(backend)
    }
    if (backendType === 'Client') {
      return this.applyToClient(backend)
    }
    throw new Error(
      `no change implementation for backend type '${backendType}'`,
    )
  }

  abstract applyToServer(backend: ServerDataStore): Promise<void>
  abstract applyToLocalGFF3(backend: LocalGFF3DataStore): Promise<void>
  abstract applyToClient(backend: ClientDataStore): Promise<void>

  abstract getInverse(): Change
}
