import {
  AssemblyDocument,
  FeatureDocument,
  RefSeqDocument,
} from 'apollo-schemas'
import { IAnyStateTreeNode, Instance, SnapshotIn } from 'mobx-state-tree'

import { FeaturesForRefName } from '../BackendDrivers/AnnotationFeature'
import { BackendDriver } from '../BackendDrivers/BackendDriver'
import { changeRegistry } from './ChangeTypes'

export interface ClientDataStore extends IAnyStateTreeNode {
  typeName: 'Client'
  features: Instance<typeof FeaturesForRefName>
  load(features: SnapshotIn<typeof FeaturesForRefName>): void
  backendDriver?: BackendDriver
  internetAccountConfigId?: string
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
  session: import('mongoose').ClientSession
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
