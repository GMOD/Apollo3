import { Module } from '@nestjs/common'

import { DevServerProxyController } from './dev-server-proxy.controller.js'

@Module({
  controllers: [DevServerProxyController],
})
export class DevServerProxyModule {}
