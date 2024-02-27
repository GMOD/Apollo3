import { Module } from '@nestjs/common'

import { AssembliesModule } from '../assemblies/assemblies.module'
import { RefSeqsModule } from '../refSeqs/refSeqs.module'
import { JBrowseController } from './jbrowse.controller'
import { JBrowseService } from './jbrowse.service';

@Module({
  controllers: [JBrowseController],
  imports: [AssembliesModule, RefSeqsModule],
  providers: [JBrowseService],
})
export class JbrowseModule {}
