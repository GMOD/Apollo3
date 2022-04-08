// import { Cache } from 'cache-manager'
// import { IAnyStateTreeNode, Instance, SnapshotIn } from 'mobx-state-tree'

// import { FeaturesForRefName } from '../BackendDrivers/AnnotationFeature'
// import { BackendDriver } from '../BackendDrivers/BackendDriver'
// import { changeRegistry } from './ChangeTypes'

import { GFF3FeatureLineWithRefs } from '@gmod/gff'
import { IAnyStateTreeNode, Instance, SnapshotIn } from 'mobx-state-tree'
import { Model } from 'mongoose'

import { FeaturesForRefName } from '../BackendDrivers/AnnotationFeature'
import { BackendDriver } from '../BackendDrivers/BackendDriver'
import { FeatureDocument } from 'apollo-schemas'
import { changeRegistry } from './ChangeTypes'

export interface ClientDataStore extends IAnyStateTreeNode {
  typeName: 'Client'
  features: Instance<typeof FeaturesForRefName>
  load(features: SnapshotIn<typeof FeaturesForRefName>): void
  backendDriver?: BackendDriver
  internetAccountConfigId?: string
}
// export interface LocalGFF3DataStore {
//   typeName: 'LocalGFF3'
//   cacheManager: Cache
//   gff3Handle: import('fs').promises.FileHandle
// }

// export interface SerializedChange extends Record<string, unknown> {
//   /** The IDs of genes, etc. that were changed in this operation */
//   changedIds: string[]
//   typeName: string
// }
export interface LocalGFF3DataStore {
  typeName: 'LocalGFF3'
  featureModel: Model<FeatureDocument>
}

export interface GFF3FeatureLineWithRefsAndFeatureId
  extends GFF3FeatureLineWithRefs {
  featureId: string
  GFF3FeatureLineWithRefs: GFF3FeatureLineWithRefs
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

  async apply(backend: DataStore): Promise<void> {
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
  abstract applyToLocalGFF3(backend: LocalGFF3DataStore): Promise<void>
  abstract applyToClient(backend: ClientDataStore): Promise<void>

  abstract getInverse(): Change
}

