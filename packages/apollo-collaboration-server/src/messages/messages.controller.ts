import { Controller, type MessageEvent, Sse } from '@nestjs/common'
import type { Observable } from 'rxjs'

import { Role } from '../utils/role/role.enum.js'
import { Validations } from '../utils/validation/validatation.decorator.js'

import { MessagesService } from './messages.service.js'

@Validations(Role.ReadOnly)
@Controller('messages')
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Sse('events')
  events(): Observable<MessageEvent> {
    return this.messagesService.subscribe()
  }
}
