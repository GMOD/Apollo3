import {
  AssemblyPermission,
  type AssemblyPermissionDocument,
} from '@apollo-annotation/schemas'
import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { type FilterQuery, Model } from 'mongoose'

import { UpdateAssemblyPermissionDto } from './dto/update-assembly-permission.dto.js'

@Injectable()
export class AssemblyPermissionsService {
  constructor(
    @InjectModel(AssemblyPermission.name)
    private readonly assemblyPermissionModel: Model<AssemblyPermissionDocument>,
  ) {}

  find(
    userId?: string,
    assemblyId?: string,
  ): Promise<AssemblyPermissionDocument[]> {
    const query: FilterQuery<AssemblyPermissionDocument> = {}
    if (userId) {
      query.userId = userId
    }
    if (assemblyId) {
      query.assemblyId = assemblyId
    }
    return this.assemblyPermissionModel.find(query).exec()
  }

  findByUser(userId: string): Promise<AssemblyPermissionDocument[]> {
    return this.assemblyPermissionModel.find({ userId }).exec()
  }

  findByAssembly(assemblyId: string): Promise<AssemblyPermissionDocument[]> {
    return this.assemblyPermissionModel.find({ assemblyId }).exec()
  }

  findOne(
    userId: string,
    assemblyId: string,
  ): Promise<AssemblyPermissionDocument | null> {
    return this.assemblyPermissionModel.findOne({ userId, assemblyId }).exec()
  }

  async canEdit(userId: string, assemblyId: string): Promise<boolean> {
    const permission = await this.findOne(userId, assemblyId)
    return Boolean(permission?.canEditAnnotations)
  }

  async canView(userId: string, assemblyId: string): Promise<boolean> {
    const permission = await this.findOne(userId, assemblyId)
    return Boolean(permission?.canViewAnnotations)
  }

  async getViewableAssemblyIds(userId: string): Promise<string[]> {
    const permissions = await this.assemblyPermissionModel
      .find({ userId, canViewAnnotations: true })
      .select('assemblyId')
      .exec()
    return permissions.map((permission) => permission.assemblyId.toString())
  }

  upsertPermission(
    userId: string,
    assemblyId: string,
    permission: UpdateAssemblyPermissionDto,
    actor?: string,
  ): Promise<AssemblyPermissionDocument | null> {
    const canViewAnnotations =
      permission.canViewAnnotations || permission.canEditAnnotations

    return this.assemblyPermissionModel
      .findOneAndUpdate(
        { userId, assemblyId },
        {
          $set: {
            canViewAnnotations,
            canEditAnnotations: permission.canEditAnnotations,
            updatedBy: actor,
          },
          $setOnInsert: {
            createdBy: actor,
          },
        },
        {
          new: true,
          upsert: true,
          runValidators: true,
        },
      )
      .exec()
  }
}
