import { Test, type TestingModule } from '@nestjs/testing'
import { getModelToken } from '@nestjs/mongoose'
import { jest } from '@jest/globals'

import { AssemblyPermissionsService } from './assemblyPermissions.service.js'
import { UpdateAssemblyPermissionDto } from './dto/update-assembly-permission.dto.js'

describe('AssemblyPermissionsService', () => {
  let service: AssemblyPermissionsService

  const execMock = jest.fn()
  const findMock = jest.fn(() => ({ exec: execMock }))
  const findOneMock = jest.fn(() => ({ exec: execMock }))
  const findOneAndUpdateMock = jest.fn(() => ({ exec: execMock }))

  const groupExecMock = jest.fn()
  const groupFindMock = jest.fn(() => ({ exec: groupExecMock }))
  const groupFindOneAndUpdateMock = jest.fn(() => ({ exec: groupExecMock }))
  const groupDeleteOneMock = jest.fn(() => ({ exec: groupExecMock }))
  const groupDeleteManyMock = jest.fn(() => ({ exec: groupExecMock }))

  const modelMock = {
    find: findMock,
    findOne: findOneMock,
    findOneAndUpdate: findOneAndUpdateMock,
  }

  const groupModelMock = {
    find: groupFindMock,
    findOne: jest.fn(() => ({ exec: groupExecMock })),
    create: jest.fn(),
    deleteOne: groupDeleteOneMock,
  }

  const groupMembershipModelMock = {
    find: groupFindMock,
    findOneAndUpdate: groupFindOneAndUpdateMock,
    deleteOne: groupDeleteOneMock,
    deleteMany: groupDeleteManyMock,
  }

  const groupAssemblyPermissionModelMock = {
    find: groupFindMock,
    findOneAndUpdate: groupFindOneAndUpdateMock,
    deleteMany: groupDeleteManyMock,
  }

  beforeEach(async () => {
    jest.clearAllMocks()
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AssemblyPermissionsService,
        {
          provide: getModelToken('AssemblyPermission'),
          useValue: modelMock,
        },
        {
          provide: getModelToken('Group'),
          useValue: groupModelMock,
        },
        {
          provide: getModelToken('GroupMembership'),
          useValue: groupMembershipModelMock,
        },
        {
          provide: getModelToken('GroupAssemblyPermission'),
          useValue: groupAssemblyPermissionModelMock,
        },
      ],
    }).compile()

    service = module.get<AssemblyPermissionsService>(AssemblyPermissionsService)
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })

  it('find should pass query params to model', async () => {
    execMock.mockResolvedValueOnce([])

    await service.find('user123', 'assembly456')

    expect(findMock).toHaveBeenCalledWith({
      userId: 'user123',
      assemblyId: 'assembly456',
    })
  })

  it('upsertPermission should force canViewAnnotations true when canEditAnnotations is true', async () => {
    execMock.mockResolvedValueOnce({})
    const dto: UpdateAssemblyPermissionDto = {
      canViewAnnotations: false,
      canEditAnnotations: true,
    }

    await service.upsertPermission('user123', 'assembly456', dto, 'admin@test')

    expect(findOneAndUpdateMock).toHaveBeenCalledWith(
      { userId: 'user123', assemblyId: 'assembly456' },
      {
        $set: {
          canViewAnnotations: true,
          canEditAnnotations: true,
          updatedBy: 'admin@test',
        },
        $setOnInsert: {
          createdBy: 'admin@test',
        },
      },
      {
        new: true,
        upsert: true,
        runValidators: true,
      },
    )
  })

  it('canEdit should return true when matching permission has canEditAnnotations', async () => {
    execMock.mockResolvedValueOnce({ canEditAnnotations: true })
    groupExecMock.mockResolvedValueOnce([])

    const result = await service.canEdit('user123', 'assembly456')

    expect(findOneMock).toHaveBeenCalledWith({
      userId: 'user123',
      assemblyId: 'assembly456',
    })
    expect(result).toBe(true)
  })

  it('canEdit should return false when no matching permission exists', async () => {
    execMock.mockResolvedValueOnce(null)
    groupExecMock.mockResolvedValueOnce([])

    const result = await service.canEdit('user123', 'assembly456')

    expect(result).toBe(false)
  })

  it('ensureAssemblyAccessGroup should return existing group when present', async () => {
    const existingGroup = { _id: 'group1', name: 'assembly:foo' }
    groupExecMock.mockResolvedValueOnce(existingGroup)

    const result = await service.ensureAssemblyAccessGroup('foo', 'admin@test')

    expect(groupModelMock.findOne).toHaveBeenCalledWith({
      name: 'assembly:foo',
    })
    expect(groupModelMock.create).not.toHaveBeenCalled()
    expect(result).toBe(existingGroup)
  })

  it('ensureAssemblyAccessGroup should create group when not present', async () => {
    groupExecMock.mockResolvedValueOnce(null)
    const createdGroup = { _id: 'group2', name: 'assembly:bar' }
    ;(groupModelMock.create as jest.Mock).mockResolvedValueOnce(createdGroup)

    const result = await service.ensureAssemblyAccessGroup('bar', 'admin@test')

    expect(groupModelMock.create).toHaveBeenCalledWith({
      name: 'assembly:bar',
      description: 'Auto-created access group for assembly bar',
      createdBy: 'admin@test',
      updatedBy: 'admin@test',
    })
    expect(result).toBe(createdGroup)
  })
})
