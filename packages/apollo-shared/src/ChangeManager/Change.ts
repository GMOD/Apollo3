import { FeatureDocument } from 'apollo-schemas'
import { Cache } from 'cache-manager'
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
  cacheManager: Cache
  gff3Handle: import('fs').promises.FileHandle
}
export interface ServerDataStore {
  typeName: 'Server'
  featureModel: import('mongoose').Model<FeatureDocument>
  session: import('mongoose').ClientSession
}

export interface SerializedChange {
  /** The IDs of genes, etc. that were changed in this operation */
  changedIds: string[]
  typeName: string
  assemblyId: string
  changes: unknown
}

export type DataStore = ServerDataStore | LocalGFF3DataStore | ClientDataStore

export abstract class Change implements SerializedChange {
  abstract typeName: string
  abstract changes: unknown[]

  assemblyId: string
  changedIds: string[]

  constructor(json: SerializedChange) {
    const { assemblyId, changedIds } = json
    this.assemblyId = assemblyId
    this.changedIds = changedIds
  }

  static fromJSON(json: SerializedChange): Change {
    const ChangeType = changeRegistry.getChangeType(json.typeName)
    return new ChangeType(json)
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
