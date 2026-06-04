import {
  AssemblyPermission,
  AssemblyPermissionSchema,
} from '@apollo-annotation/schemas'
import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'

import { AssemblyPermissionsController } from './assemblyPermissions.controller.js'
import { AssemblyPermissionsService } from './assemblyPermissions.service.js'

@Module({
  controllers: [AssemblyPermissionsController],
  providers: [AssemblyPermissionsService],
  imports: [
    MongooseModule.forFeature([
      { name: AssemblyPermission.name, schema: AssemblyPermissionSchema },
    ]),
  ],
  exports: [AssemblyPermissionsService, MongooseModule],
})
export class AssemblyPermissionsModule {}
