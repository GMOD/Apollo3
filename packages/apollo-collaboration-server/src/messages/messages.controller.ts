import { Controller, type MessageEvent, Sse } from '@nestjs/common'
import { ApiExcludeController } from '@nestjs/swagger'
import type { Observable } from 'rxjs'

import { Role } from '../utils/role/role.enum.js'
import { Validations } from '../utils/validation/validatation.decorator.js'

import { MessagesService } from './messages.service.js'

// Left out of the API docs because it's a server-sent events stream for the
// Apollo JBrowse plugin, not a REST endpoint
@ApiExcludeController()
@Validations(Role.ReadOnly)
@Controller('messages')
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Sse('events')
  events(): Observable<MessageEvent> {
    return this.messagesService.subscribe()
  }
}
