import { Module } from '@nestjs/common'

import { MessagesController } from './messages.controller.js'
import { MessagesService } from './messages.service.js'

@Module({
  controllers: [MessagesController],
  providers: [MessagesService],
  exports: [MessagesService],
})
export class MessagesModule {}
