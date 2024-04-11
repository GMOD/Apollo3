import {
  Change,
  ChangeOptions,
  ClientDataStore,
  LocalGFF3DataStore,
  SerializedChange,
  ServerDataStore,
} from '@apollo-annotation/common'

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
    const { logger, trackConfig } = this
    const jsonObject = JSON.parse(trackConfig)
    const suffix = '-sessionTrack'
    // Remove '-sessionTrack' if exists
    if (jsonObject.trackId.endsWith(suffix)) {
      jsonObject.trackId = jsonObject.trackId.slice(
        0,
        jsonObject.trackId.length - suffix.length,
      )
    }
    const tracks = await trackModel.find({
      trackId: new RegExp(`^${jsonObject.trackId}`),
    })
    if (tracks.length > 0) {
      throw new Error('Same track already exists in database.')
    }
    // Check if 'metadata' exists, if not, initialize it
    if (!jsonObject.metadata) {
      jsonObject.metadata = {}
    }
    jsonObject.metadata.savedToApollo = true
    await trackModel.create({
      trackConfig: jsonObject,
    })
    logger.debug?.(`Added "${jsonObject.trackId}" new track into database.`)
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
