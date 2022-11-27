import { SerializedChange } from 'apollo-shared'

export class Message {
  changeInfo: SerializedChange
  channel: string
  userName: string
  userToken: string // Contains token of user who made the change in UI
  timestamp: number
}

export class UserLocationMessage {
  channel: string
  assemblyId: string
  refSeq: string
  featureId: string
  start: string
  end: string
  userName: string
  userToken: string // Contains token of user who made the change in UI
}
