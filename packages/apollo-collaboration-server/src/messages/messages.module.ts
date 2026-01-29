import { Module } from '@nestjs/common'

import { MessagesGateway } from './messages.gateway.js'
import { MessagesService } from './messages.service.js'

@Module({
  providers: [MessagesGateway, MessagesService],
  exports: [MessagesGateway],
})
export class MessagesModule {}
