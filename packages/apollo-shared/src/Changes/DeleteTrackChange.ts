import {
  Change,
  ChangeOptions,
  ClientDataStore,
  LocalGFF3DataStore,
  SerializedChange,
  ServerDataStore,
} from '@apollo-annotation/common'

import { generateRandomString } from '../Common'

export interface SerializedDeleteTrackChangeBase extends SerializedChange {
  typeName: 'DeleteTrackChange'
  trackConfig: string
}

export interface DeleteTrackChangeDetails {
  role: 'admin' | 'user' | 'readOnly'
}

export interface SerializedDeleteTrackChangeSingle
  extends SerializedDeleteTrackChangeBase,
    DeleteTrackChangeDetails {}

export interface SerializedDeleteTrackChangeMultiple
  extends SerializedDeleteTrackChangeBase {
  changes: DeleteTrackChangeDetails[]
}

export type SerializedDeleteTrackChange =
  | SerializedDeleteTrackChangeSingle
  | SerializedDeleteTrackChangeMultiple

export class DeleteTrackChange extends Change {
  typeName = 'DeleteTrackChange' as const
  changes: DeleteTrackChangeDetails[]
  trackConfig: string

  constructor(json: SerializedDeleteTrackChange, options?: ChangeOptions) {
    super(json, options)
    this.changes = 'changes' in json ? json.changes : [json]
    this.trackConfig = json.trackConfig
  }

  toJSON(): SerializedDeleteTrackChange {
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
    let { trackId } = jsonObject
    const suffix = '-sessionTrack'
    // Remove '-sessionTrack' if exists
    if (trackId.endsWith(suffix)) {
      trackId = trackId.slice(0, trackId.length - suffix.length)
    }
    await trackModel.deleteOne({ trackId: new RegExp(`^${trackId}`) })
    logger.debug?.(`Deleted track "${trackId}" from database.`)
  }

  async executeOnLocalGFF3(_backend: LocalGFF3DataStore) {
    throw new Error('executeOnLocalGFF3 not implemented')
  }

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  async executeOnClient(_dataStore: ClientDataStore) {}

  getInverse() {
    const { changes, logger, trackConfig, typeName } = this
    return new DeleteTrackChange({ typeName, changes, trackConfig }, { logger })
  }
}
