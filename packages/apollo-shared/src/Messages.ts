import type { SerializedChange } from '@apollo-annotation/common'
import type { CheckResultSnapshot } from '@apollo-annotation/mst'

interface BaseMessage {
  channel: string
  userName: string
  userSessionId: string
}

export interface ChangeMessage extends BaseMessage {
  changeInfo: SerializedChange
  changeSequence: number
}
export interface CheckResultUpdate extends BaseMessage {
  checkResult: CheckResultSnapshot
  deleted?: boolean
}

export interface UserLocation {
  assemblyId: string
  refSeq: string
  start: number
  end: number
}

export interface UserLocationMessage extends BaseMessage {
  locations: UserLocation[]
}

export interface RequestUserInformationMessage extends BaseMessage {
  readonly reqType: 'CURRENT_LOCATION'
}
