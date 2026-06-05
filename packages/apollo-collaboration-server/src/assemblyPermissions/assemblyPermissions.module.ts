import {
  AssemblyPermission,
  AssemblyPermissionSchema,
  Group,
  GroupAssemblyPermission,
  GroupAssemblyPermissionSchema,
  GroupMembership,
  GroupMembershipSchema,
  GroupSchema,
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
      { name: Group.name, schema: GroupSchema },
      { name: GroupMembership.name, schema: GroupMembershipSchema },
      {
        name: GroupAssemblyPermission.name,
        schema: GroupAssemblyPermissionSchema,
      },
    ]),
  ],
  exports: [AssemblyPermissionsService, MongooseModule],
})
export class AssemblyPermissionsModule {}
