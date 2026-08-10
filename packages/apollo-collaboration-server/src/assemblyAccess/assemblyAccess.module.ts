import { Global, Module } from '@nestjs/common'

import { AssembliesModule } from '../assemblies/assemblies.module.js'
import { FeaturesModule } from '../features/features.module.js'
import { RefSeqsModule } from '../refSeqs/refSeqs.module.js'

import { AssemblyAccessService } from './assemblyAccess.service.js'

/**
 * Global so controllers and services can inject AssemblyAccessService without
 * importing this module, which would create import cycles with the modules it
 * takes its models from.
 */
@Global()
@Module({
  imports: [AssembliesModule, FeaturesModule, RefSeqsModule],
  providers: [AssemblyAccessService],
  exports: [AssemblyAccessService],
})
export class AssemblyAccessModule {}
