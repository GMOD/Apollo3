/* eslint-disable @typescript-eslint/require-await */
import { randomUUID } from 'node:crypto'

import { Injectable, Logger } from '@nestjs/common'
import {
  type OnGatewayConnection,
  type OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets'
import { Server, Socket } from 'socket.io'

import { runWithCorrelationId } from '../utils/request-context.js'

import { CreateMessageDto } from './dto/create-message.dto.js'

interface SocketData {
  connectionId: string
}

/**
 * Log lines emitted while handling socket events carry a per-connection
 * correlation ID (stored on `client.data.connectionId`). This is unrelated to
 * the per-HTTP-request IDs: the HTTP request context does not extend into
 * independent socket event handlers.
 */
@WebSocketGateway({ cors: { origin: '*' } })
@Injectable()
export class MessagesGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(MessagesGateway.name)

  @WebSocketServer()
  server: Server

  handleConnection(client: Socket<never, never, never, SocketData>) {
    const connectionId = randomUUID()
    client.data.connectionId = connectionId
    runWithCorrelationId(connectionId, () => {
      this.logger.debug(`Socket connected (socket id "${client.id}")`)
    })
  }

  handleDisconnect(client: Socket<never, never, never, SocketData>) {
    runWithCorrelationId(client.data.connectionId, () => {
      this.logger.debug(`Socket disconnected (socket id "${client.id}")`)
    })
  }

  /**
   * Broadcasts a message to all connected clients. Usually called directly by
   * other services (in which case the current HTTP request's correlation ID
   * applies), but also subscribed as the "createMessage" socket event.
   */
  @SubscribeMessage('createMessage')
  async create(eventName: string, createMessageDto: CreateMessageDto) {
    // When invoked as a socket event handler, Nest passes the client socket as
    // the first argument
    const client = eventName as unknown
    if (client instanceof Socket) {
      const { connectionId } = client.data as SocketData
      runWithCorrelationId(connectionId, () => {
        this.logger.debug('Received "createMessage" socket event')
        this.broadcast(eventName, createMessageDto)
      })
      return
    }
    this.logger.debug(`Broadcasting message on channel "${eventName}"`)
    this.broadcast(eventName, createMessageDto)
  }

  // Failures are left to propagate: Nest's WsExceptionsHandler (socket events)
  // or GlobalExceptionsFilter (HTTP) logs them once
  private broadcast(eventName: string, createMessageDto: CreateMessageDto) {
    this.server.emit(eventName, createMessageDto)
  }
}
