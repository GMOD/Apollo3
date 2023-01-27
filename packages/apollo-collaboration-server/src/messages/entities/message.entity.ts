import { SerializedChange } from 'apollo-shared'

export class Message {
  changeInfo: SerializedChange
  channel: string
  userName: string
  userToken: string // Contains token of user who made the change in UI
  changeSequence: number
}

export class UserLocationMessage {
  channel: string
  locations: UserLocation[]
  userName: string
  userToken: string // Contains token of user who made the change in UI
}

export class UserLocation {
  assemblyId: string
  refSeq: string
  start: string
  end: string
}
