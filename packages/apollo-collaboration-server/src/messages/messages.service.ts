import { Injectable, type MessageEvent } from '@nestjs/common'
import { Subject } from 'rxjs'

@Injectable()
export class MessagesService {
  private readonly events = new Subject<MessageEvent>()

  broadcast(eventName: string, payload: object) {
    this.events.next({ type: eventName, data: payload })
  }

  subscribe() {
    return this.events.asObservable()
  }
}
