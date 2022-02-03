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
  serializedChange: SerializedChange
  cacheManager: Cache
  envMap: Map<string, string>
}

export interface SerializedChange extends Record<string, unknown> {
  /** The IDs of genes, etc. that were changed in this operation */
  changedIds: string[]
  typeName: string
}

export type DataStore = LocalGFF3DataStore | ClientDataStore

export abstract class Change {
  /** have this return name of change type */
  abstract get typeName(): string

  static fromJSON(json: SerializedChange): Change {
    const ChangeType = changeRegistry.getChangeType(json.typeName)
    return new ChangeType(json)
  }

  abstract toJSON(): SerializedChange

  apply(backend: DataStore): void {
    const backendType = backend.typeName
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

  abstract applyToLocalGFF3(backend: LocalGFF3DataStore): void
  abstract applyToClient(backend: ClientDataStore): void

  abstract getInverse(): Change
}
