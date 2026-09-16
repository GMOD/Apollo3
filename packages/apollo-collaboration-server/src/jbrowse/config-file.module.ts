import { Module } from '@nestjs/common'

import { ConfigFileController } from './config-file.controller.js'
import { JBrowseConfigModule } from './jbrowseConfig.module.js'
import { JBrowseModule } from './jbrowse.module.js'

/**
 * Registered in AppModule's imports right before ServeStaticModule and the
 * conditional DevServerProxyModule. Its catch-all GET route only claims the
 * literal paths of the configured config.json files and hands everything
 * else back to Express with `next()`, so its position there just limits the
 * extra guard-pipeline pass to non-API requests - it isn't load-bearing for
 * correctness, since an unmatched path falls through regardless of where
 * this sits.
 */
@Module({
  imports: [JBrowseConfigModule, JBrowseModule],
  controllers: [ConfigFileController],
})
export class ConfigFileModule {}
