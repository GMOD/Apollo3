import { Module, forwardRef } from '@nestjs/common'

import { AssembliesModule } from '../assemblies/assemblies.module.js'
import { ChecksModule } from '../checks/checks.module.js'
import { RefSeqsModule } from '../refSeqs/refSeqs.module.js'

import { JBrowseConfigModule } from './jbrowseConfig.module.js'
import { JBrowseController } from './jbrowse.controller.js'
import { JBrowseService } from './jbrowse.service.js'

@Module({
  controllers: [JBrowseController],
  imports: [
    forwardRef(() => AssembliesModule),
    ChecksModule,
    JBrowseConfigModule,
    RefSeqsModule,
  ],
  providers: [JBrowseService],
  exports: [JBrowseService],
})
export class JBrowseModule {}
