import { changeRegistry } from './ChangeTypes'

interface ClientDataStore {
  typeName: 'Client'
}
interface LocalGFF3DataStore {
  typeName: 'LocalGFF3'
}

export interface SerializedChange extends Record<string, unknown> {
  /** The IDs of genes, etc. that were changed in this operation */
  changedIds: string[]
  typeName: string
}

type DataStore = LocalGFF3DataStore | ClientDataStore

export abstract class Change {
  /** have this return name of change type */
  abstract get typeName(): string

  abstract _fromJSON(json: SerializedChange): Change

  static fromJSON(json: SerializedChange): Change {
    const ChangeType = changeRegistry.getChangeType(json.typeName)
    const change = new ChangeType()
    return change._fromJSON(json)
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

  abstract applyToLocalGFF3(backend: DataStore): void
  abstract applyToClient(backend: DataStore): void

  abstract getInverse(): Change
}
