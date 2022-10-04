import { ReadStream } from 'fs'

import { Region } from '@jbrowse/core/util'
import { AppRootModel } from '@jbrowse/core/util'
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
} from 'apollo-schemas'

import { ChangeManager } from './ChangeManager'
import { changeRegistry } from './ChangeTypes'

export interface ClientDataStore {
  typeName: 'Client'
  assemblies: Map<string, ApolloAssemblyI>
  changeManager: ChangeManager
  internetAccounts: AppRootModel['internetAccounts']
  loadFeatures(regions: Region[]): void
  getFeature(featureId: string): AnnotationFeatureI | undefined
  addFeature(assemblyId: string, feature: AnnotationFeatureSnapshot): void
  deleteFeature(featureId: string): void
}
export interface LocalGFF3DataStore {
  typeName: 'LocalGFF3'
  gff3Handle: import('fs').promises.FileHandle
}
export interface ServerDataStore {
  typeName: 'Server'
  featureModel: import('mongoose').Model<FeatureDocument>
  assemblyModel: import('mongoose').Model<AssemblyDocument>
  refSeqModel: import('mongoose').Model<RefSeqDocument>
  refSeqChunkModel: import('mongoose').Model<RefSeqChunkDocument>
  fileModel: import('mongoose').Model<FileDocument>
  session: import('mongoose').ClientSession
  filesService: {
    getFileStream(file: FileDocument): import('fs').ReadStream
    parseGFF3(stream: ReadStream): ReadStream
  }
}

export interface SerializedChange {
  /** The IDs of genes, etc. that were changed in this operation */
  changedIds: string[]
  typeName: string
  assemblyId: string
}

export type DataStore = ServerDataStore | LocalGFF3DataStore | ClientDataStore

export interface ChangeOptions {
  logger: import('@nestjs/common').LoggerService
}

export abstract class Change implements SerializedChange {
  protected logger: import('@nestjs/common').LoggerService
  abstract typeName: string

  assemblyId: string
  changedIds: string[]

  constructor(json: SerializedChange, options?: ChangeOptions) {
    const { assemblyId, changedIds } = json
    this.assemblyId = assemblyId
    this.changedIds = changedIds
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
