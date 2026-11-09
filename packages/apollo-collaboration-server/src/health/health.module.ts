import { Module } from '@nestjs/common'
import { TerminusModule } from '@nestjs/terminus'

import { MessagesModule } from '../messages/messages.module.js'

import { HealthController } from './health.controller.js'

@Module({
  imports: [TerminusModule, MessagesModule],
  controllers: [HealthController],
})
export class HealthModule {}
