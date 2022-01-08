interface ClientDataStore {
  typeName: 'Client'
}
interface LocalGFF3DataStore {
  typeName: 'LocalGFF3'
}

type DataStore = LocalGFF3DataStore | ClientDataStore

export abstract class Change {
  /** have this return name of change type */
  abstract get typeName(): string

  static fromJSON(json: Record<string, unknown>): Change {
    throw new Error('override fromJSON')
  }

  abstract toJSON(): Record<string, unknown>

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
