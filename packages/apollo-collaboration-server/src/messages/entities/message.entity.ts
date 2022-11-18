import { SerializedChange } from 'apollo-shared'
import { Timestamp } from 'rxjs'

export class Message {
  changeInfo: SerializedChange
  channel: string
  userName: string
  userToken: string // Contains token of user who made the change in UI
  timestamp: number
}
