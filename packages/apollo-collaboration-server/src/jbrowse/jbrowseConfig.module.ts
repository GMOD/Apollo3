import { Module } from '@nestjs/common'

import { JBrowseConfigService } from './jbrowseConfig.service.js'

@Module({
  providers: [JBrowseConfigService],
  exports: [JBrowseConfigService],
})
export class JBrowseConfigModule {}
