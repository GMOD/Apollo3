import { SerializedChange } from "apollo-shared"

export class Message {
  changeInfo: SerializedChange
  channel: string
  userName: string
}