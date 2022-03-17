import { Module } from '@nestjs/common';
import { AssembliesController } from './assemblies.controller';
import { AssembliesService } from './assemblies.service';

@Module({
  controllers: [AssembliesController],
  providers: [AssembliesService]
})
export class AssembliesModule {}
