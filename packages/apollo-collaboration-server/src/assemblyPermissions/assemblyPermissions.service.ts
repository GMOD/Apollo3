import {
  AssemblyPermission,
  type AssemblyPermissionDocument,
  Group,
  type GroupAssemblyPermissionDocument,
  GroupAssemblyPermission,
  type GroupDocument,
  type GroupMembershipDocument,
  GroupMembership,
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
    @InjectModel(Group.name)
    private readonly groupModel: Model<GroupDocument>,
    @InjectModel(GroupMembership.name)
    private readonly groupMembershipModel: Model<GroupMembershipDocument>,
    @InjectModel(GroupAssemblyPermission.name)
    private readonly groupAssemblyPermissionModel: Model<GroupAssemblyPermissionDocument>,
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

  findGroups(): Promise<GroupDocument[]> {
    return this.groupModel.find().sort({ name: 1 }).exec()
  }

  getAssemblyAccessGroupName(assemblyName: string): string {
    return `assembly:${assemblyName}`
  }

  async ensureAssemblyAccessGroup(
    assemblyName: string,
    actor?: string,
  ): Promise<GroupDocument> {
    const name = this.getAssemblyAccessGroupName(assemblyName)
    const existing = await this.groupModel.findOne({ name }).exec()
    if (existing) {
      return existing
    }
    return this.groupModel.create({
      name,
      description: `Auto-created access group for assembly ${assemblyName}`,
      createdBy: actor,
      updatedBy: actor,
    })
  }

  createGroup(
    name: string,
    description?: string,
    actor?: string,
  ): Promise<GroupDocument> {
    return this.groupModel.create({
      name: name.trim(),
      description: description?.trim() || undefined,
      createdBy: actor,
      updatedBy: actor,
    })
  }

  async deleteGroup(groupId: string): Promise<{ deleted: boolean }> {
    await this.groupMembershipModel.deleteMany({ groupId }).exec()
    await this.groupAssemblyPermissionModel.deleteMany({ groupId }).exec()
    const result = await this.groupModel.deleteOne({ _id: groupId }).exec()
    return { deleted: result.deletedCount > 0 }
  }

  findGroupMembershipsByUser(
    userId: string,
  ): Promise<GroupMembershipDocument[]> {
    return this.groupMembershipModel.find({ userId }).exec()
  }

  findGroupMembershipsByGroup(
    groupId: string,
  ): Promise<GroupMembershipDocument[]> {
    return this.groupMembershipModel.find({ groupId }).exec()
  }

  async setGroupMembership(
    groupId: string,
    userId: string,
    isMember: boolean,
    actor?: string,
  ): Promise<{ groupId: string; userId: string; isMember: boolean }> {
    if (isMember) {
      await this.groupMembershipModel
        .findOneAndUpdate(
          { groupId, userId },
          {
            $set: {
              updatedBy: actor,
            },
            $setOnInsert: {
              createdBy: actor,
            },
          },
          {
            upsert: true,
            new: true,
            runValidators: true,
          },
        )
        .exec()
      return { groupId, userId, isMember: true }
    }

    await this.groupMembershipModel.deleteOne({ groupId, userId }).exec()
    return { groupId, userId, isMember: false }
  }

  findGroupPermissions(
    groupId: string,
  ): Promise<GroupAssemblyPermissionDocument[]> {
    return this.groupAssemblyPermissionModel.find({ groupId }).exec()
  }

  upsertGroupPermission(
    groupId: string,
    assemblyId: string,
    permission: UpdateAssemblyPermissionDto,
    actor?: string,
  ): Promise<GroupAssemblyPermissionDocument | null> {
    const canViewAnnotations =
      permission.canViewAnnotations || permission.canEditAnnotations

    return this.groupAssemblyPermissionModel
      .findOneAndUpdate(
        { groupId, assemblyId },
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

  private async getEffectivePermissionForAssembly(
    userId: string,
    assemblyId: string,
  ): Promise<{ canViewAnnotations: boolean; canEditAnnotations: boolean }> {
    const directPermission = await this.findOne(userId, assemblyId)
    const canViewAnnotations = Boolean(directPermission?.canViewAnnotations)
    const canEditAnnotations = Boolean(directPermission?.canEditAnnotations)

    const memberships = await this.findGroupMembershipsByUser(userId)
    const groupIds = memberships.map((membership) => membership.groupId)
    if (groupIds.length === 0) {
      return { canViewAnnotations, canEditAnnotations }
    }

    const groupPermissions = await this.groupAssemblyPermissionModel
      .find({ groupId: { $in: groupIds }, assemblyId })
      .select('canViewAnnotations canEditAnnotations')
      .exec()

    return {
      canViewAnnotations:
        canViewAnnotations ||
        groupPermissions.some((permission) => permission.canViewAnnotations),
      canEditAnnotations:
        canEditAnnotations ||
        groupPermissions.some((permission) => permission.canEditAnnotations),
    }
  }

  async findEffectiveByUser(userId: string): Promise<
    Array<{
      _id: string
      userId: string
      assemblyId: string
      canViewAnnotations: boolean
      canEditAnnotations: boolean
      source: 'direct' | 'group' | 'mixed'
    }>
  > {
    const directPermissions = await this.findByUser(userId)
    const permissionsByAssembly = new Map<
      string,
      {
        canViewAnnotations: boolean
        canEditAnnotations: boolean
        hasDirect: boolean
        hasGroup: boolean
      }
    >()

    for (const permission of directPermissions) {
      permissionsByAssembly.set(permission.assemblyId.toString(), {
        canViewAnnotations: Boolean(permission.canViewAnnotations),
        canEditAnnotations: Boolean(permission.canEditAnnotations),
        hasDirect: true,
        hasGroup: false,
      })
    }

    const memberships = await this.findGroupMembershipsByUser(userId)
    const groupIds = memberships.map((membership) => membership.groupId)
    if (groupIds.length > 0) {
      const groupPermissions = await this.groupAssemblyPermissionModel
        .find({ groupId: { $in: groupIds } })
        .exec()
      for (const permission of groupPermissions) {
        const assemblyId = permission.assemblyId.toString()
        const current = permissionsByAssembly.get(assemblyId) ?? {
          canViewAnnotations: false,
          canEditAnnotations: false,
          hasDirect: false,
          hasGroup: false,
        }
        permissionsByAssembly.set(assemblyId, {
          canViewAnnotations:
            current.canViewAnnotations ||
            Boolean(permission.canViewAnnotations),
          canEditAnnotations:
            current.canEditAnnotations ||
            Boolean(permission.canEditAnnotations),
          hasDirect: current.hasDirect,
          hasGroup: true,
        })
      }
    }

    return [...permissionsByAssembly.entries()].map(([assemblyId, value]) => ({
      _id: `${userId}-${assemblyId}`,
      userId,
      assemblyId,
      canViewAnnotations: value.canViewAnnotations,
      canEditAnnotations: value.canEditAnnotations,
      source:
        value.hasDirect && value.hasGroup
          ? 'mixed'
          : value.hasGroup
            ? 'group'
            : 'direct',
    }))
  }

  findOne(
    userId: string,
    assemblyId: string,
  ): Promise<AssemblyPermissionDocument | null> {
    return this.assemblyPermissionModel.findOne({ userId, assemblyId }).exec()
  }

  async canEdit(userId: string, assemblyId: string): Promise<boolean> {
    const permission = await this.getEffectivePermissionForAssembly(
      userId,
      assemblyId,
    )
    return Boolean(permission.canEditAnnotations)
  }

  async canView(userId: string, assemblyId: string): Promise<boolean> {
    const permission = await this.getEffectivePermissionForAssembly(
      userId,
      assemblyId,
    )
    return Boolean(permission.canViewAnnotations)
  }

  async getViewableAssemblyIds(userId: string): Promise<string[]> {
    const effectivePermissions = await this.findEffectiveByUser(userId)
    return effectivePermissions
      .filter((permission) => permission.canViewAnnotations)
      .map((permission) => permission.assemblyId)
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
