import { Controller, type MessageEvent, Sse } from '@nestjs/common'
import { ApiExcludeController } from '@nestjs/swagger'
import {
  type Observable,
  endWith,
  ignoreElements,
  interval,
  map,
  merge,
  takeUntil,
} from 'rxjs'

import { Role } from '../utils/role/role.enum.js'
import { Validations } from '../utils/validation/validatation.decorator.js'

import { MessagesService } from './messages.service.js'

/**
 * How often to send a "ping" event so proxies don't close idle connections.
 * Clients only listen for named events, so they ignore it.
 */
export const HEARTBEAT_INTERVAL_MS = 30_000

// Left out of the API docs because it's a server-sent events stream for the
// Apollo JBrowse plugin, not a REST endpoint
@ApiExcludeController()
@Validations(Role.ReadOnly)
@Controller('messages')
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Sse('events')
  events(): Observable<MessageEvent> {
    const events = this.messagesService.subscribe()
    const heartbeats = interval(HEARTBEAT_INTERVAL_MS).pipe(
      map((): MessageEvent => ({ type: 'ping', data: {} })),
      // Stop with the events so the response ends when the server shuts down
      takeUntil(events.pipe(ignoreElements(), endWith(null))),
    )
    return merge(events, heartbeats)
  }
}
