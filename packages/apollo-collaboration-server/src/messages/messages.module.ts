import { Module } from '@nestjs/common'

import { MessagesGateway } from './messages.gateway'
import { MessagesService } from './messages.service'

@Module({
  providers: [MessagesGateway, MessagesService],
  exports: [MessagesGateway],
})
export class MessagesModule {}
