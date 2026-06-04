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

  const modelMock = {
    find: findMock,
    findOne: findOneMock,
    findOneAndUpdate: findOneAndUpdateMock,
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

    const result = await service.canEdit('user123', 'assembly456')

    expect(findOneMock).toHaveBeenCalledWith({
      userId: 'user123',
      assemblyId: 'assembly456',
    })
    expect(result).toBe(true)
  })

  it('canEdit should return false when no matching permission exists', async () => {
    execMock.mockResolvedValueOnce(null)

    const result = await service.canEdit('user123', 'assembly456')

    expect(result).toBe(false)
  })
})
