import { UnprocessableEntityException } from '@nestjs/common'

import { ChangesService } from './changes.service.js'

describe('ChangesService', () => {
  let service: ChangesService
  const assemblyPermissionsService = {
    canEdit: jest.fn(),
    getViewableAssemblyIds: jest.fn(),
  }
  const changeModel = {
    find: jest.fn(() => ({
      sort: jest.fn(() => ({
        exec: jest.fn().mockResolvedValue([]),
      })),
    })),
    countDocuments: jest.fn(() => ({ exec: jest.fn().mockResolvedValue(0) })),
  }
  const countersService = {
    getNextSequenceValue: jest.fn(),
  }

  beforeEach(() => {
    jest.clearAllMocks()
    service = new ChangesService(
      {} as never,
      {} as never,
      {} as never,
      changeModel as never,
      {} as never,
      // Slice 2 dependency
      assemblyPermissionsService as never,
      countersService as never,
      {} as never,
      {} as never,
    )
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })

  it('denies non-admin assembly change when user lacks edit permission', async () => {
    assemblyPermissionsService.canEdit.mockResolvedValueOnce(false)
    const change = {
      typeName: 'DeleteFeatureChange',
      assembly: 'assembly123',
    }
    const user = {
      id: 'user123',
      username: 'user1',
      email: 'user1@test',
      role: 'user',
      iat: 1,
      exp: 2,
    }

    await expect(
      service.create(change as never, user as never),
    ).rejects.toThrow(UnprocessableEntityException)
    expect(assemblyPermissionsService.canEdit).toHaveBeenCalledWith(
      'user123',
      'assembly123',
    )
    expect(countersService.getNextSequenceValue).not.toHaveBeenCalled()
  })

  it('findAll limits non-admin users to permitted assemblies', async () => {
    assemblyPermissionsService.getViewableAssemblyIds.mockResolvedValueOnce([
      'assembly123',
    ])

    await service.findAll({ typeName: 'DeleteFeatureChange' }, {
      id: 'user123',
      username: 'user1',
      email: 'user1@test',
      role: 'user',
      iat: 1,
      exp: 2,
    } as never)

    expect(changeModel.find).toHaveBeenCalledWith(
      expect.objectContaining({
        assembly: { $in: ['assembly123'] },
        typeName: 'DeleteFeatureChange',
      }),
    )
  })
})
