import { SerializedChange } from 'apollo-common'

interface BaseMessage {
  channel: string
  userName: string
  userSessionId: string
}

export interface ChangeMessage extends BaseMessage {
  changeInfo: SerializedChange
  changeSequence: number
}

export interface UserLocation {
  assemblyId: string
  refSeq: string
  start: string
  end: string
}

export interface UserLocationMessage extends BaseMessage {
  locations: UserLocation[]
}

export interface RequestUserInformationMessage extends BaseMessage {
  readonly reqType: 'CURRENT_LOCATION'
}
