/* eslint-disable @typescript-eslint/require-await */
import { Injectable } from '@nestjs/common'
import {
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets'
import { Server } from 'socket.io'

import { CreateMessageDto } from './dto/create-message.dto'
import { MessagesService } from './messages.service'

@WebSocketGateway({ cors: { origin: '*' } })
@Injectable()
export class MessagesGateway {
  @WebSocketServer()
  server: Server

  constructor(private readonly messagesService: MessagesService) {}

  @SubscribeMessage('createMessage')
  async create(eventName: string, createMessageDto: CreateMessageDto) {
    this.server.emit(eventName, createMessageDto)
  }
}
