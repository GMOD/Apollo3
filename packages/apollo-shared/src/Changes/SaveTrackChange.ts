import {
  Change,
  ChangeOptions,
  ClientDataStore,
  LocalGFF3DataStore,
  SerializedChange,
  ServerDataStore,
} from 'apollo-common'

export interface SerializedSaveTrackChangeBase extends SerializedChange {
  typeName: 'SaveTrackChange'
  trackConfig: string
}

export interface SaveTrackChangeDetails {
  role: 'admin' | 'user' | 'readOnly'
}

export interface SerializedSaveTrackChangeSingle
  extends SerializedSaveTrackChangeBase,
    SaveTrackChangeDetails {}

export interface SerializedSaveTrackChangeMultiple
  extends SerializedSaveTrackChangeBase {
  changes: SaveTrackChangeDetails[]
}

export type SerializedSaveTrackChange =
  | SerializedSaveTrackChangeSingle
  | SerializedSaveTrackChangeMultiple

export class SaveTrackChange extends Change {
  typeName = 'SaveTrackChange' as const
  changes: SaveTrackChangeDetails[]
  trackConfig: string

  constructor(json: SerializedSaveTrackChange, options?: ChangeOptions) {
    super(json, options)
    this.changes = 'changes' in json ? json.changes : [json]
    this.trackConfig = json.trackConfig
  }

  toJSON(): SerializedSaveTrackChange {
    const { changes, trackConfig, typeName } = this
    if (changes.length === 1) {
      const [{ role }] = changes
      return { typeName, trackConfig, role }
    }
    return { typeName, trackConfig, changes }
  }

  async executeOnServer(backend: ServerDataStore) {
    const { trackModel } = backend
    const { trackConfig } = this
    const jsonObject = JSON.parse(trackConfig)
    const { trackId, type } = jsonObject
    await trackModel.create({ type, trackId, trackConfig: jsonObject })
  }

  async executeOnLocalGFF3(_backend: LocalGFF3DataStore) {
    throw new Error('executeOnLocalGFF3 not implemented')
  }

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  async executeOnClient(_dataStore: ClientDataStore) {}

  getInverse() {
    const { changes, logger, trackConfig, typeName } = this
    return new SaveTrackChange({ typeName, changes, trackConfig }, { logger })
  }
}
