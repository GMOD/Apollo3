import { DeleteFeatureChange, type DecodedJWT } from '@apollo-annotation/shared'
import { beforeEach, describe, expect, it, jest } from '@jest/globals'
import { UnprocessableEntityException } from '@nestjs/common'

import { ChangesService } from './changes.service.js'

function makeExec<T>(value: T) {
  return { exec: jest.fn<() => Promise<T>>().mockResolvedValue(value) }
}

type ChangesServiceCtorArgs = ConstructorParameters<typeof ChangesService>
type DeleteFeatureChangeInit = ConstructorParameters<
  typeof DeleteFeatureChange
>[0]

describe('ChangesService', () => {
  let service: ChangesService
  const assemblyPermissionsService = {
    canEdit: jest.fn<(userId: string, assembly: string) => Promise<boolean>>(),
    getViewableAssemblyIds: jest.fn<(userId: string) => Promise<string[]>>(),
  }
  const findExec = makeExec([])
  const findSort = { sort: jest.fn(() => findExec) }
  const changeModel = {
    find: jest.fn(() => findSort),
    countDocuments: jest.fn(() => makeExec(0)),
  }
  const countersService = {
    getNextSequenceValue: jest.fn<(counterName: string) => Promise<number>>(),
  }
  const emptyExec = makeExec([])
  const assemblyModel = { deleteMany: jest.fn(() => emptyExec) }
  const refSeqModel = { deleteMany: jest.fn(() => emptyExec) }
  const refSeqChunkModel = { deleteMany: jest.fn(() => emptyExec) }
  const featureModel = {
    db: {
      transaction: jest.fn(async () => Promise.resolve()),
    },
    deleteMany: jest.fn(() => emptyExec),
  }

  beforeEach(() => {
    jest.clearAllMocks()
    service = new ChangesService(
      featureModel as ChangesServiceCtorArgs[0],
      assemblyModel as ChangesServiceCtorArgs[1],
      refSeqModel as ChangesServiceCtorArgs[2],
      refSeqChunkModel as ChangesServiceCtorArgs[3],
      changeModel as ChangesServiceCtorArgs[4],
      // Slice 2 dependency
      assemblyPermissionsService as ChangesServiceCtorArgs[5],
      countersService as ChangesServiceCtorArgs[6],
      {} as ChangesServiceCtorArgs[7],
      {} as ChangesServiceCtorArgs[8],
    )
    countersService.getNextSequenceValue.mockResolvedValue(1)
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })

  it('denies non-admin assembly change when user lacks edit permission', async () => {
    assemblyPermissionsService.canEdit.mockResolvedValueOnce(false)
    const change = new DeleteFeatureChange({
      typeName: 'DeleteFeatureChange',
      assembly: 'assembly123',
      changedIds: ['feature123'],
      deletedFeature: {
        _id: 'feature123',
        refSeq: 'refSeq1',
        type: 'gene',
        min: 1,
        max: 10,
      } as DeleteFeatureChangeInit['deletedFeature'],
    })
    const user: DecodedJWT = {
      id: 'user123',
      username: 'user1',
      email: 'user1@test',
      role: 'user',
      iat: 1,
      exp: 2,
    }

    await expect(service.create(change, user)).rejects.toThrow(
      UnprocessableEntityException,
    )
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

    const user: DecodedJWT = {
      id: 'user123',
      username: 'user1',
      email: 'user1@test',
      role: 'user',
      iat: 1,
      exp: 2,
    }
    await service.findAll({ typeName: 'DeleteFeatureChange' }, user)

    expect(changeModel.find).toHaveBeenCalledWith(
      expect.objectContaining({
        assembly: { $in: ['assembly123'] },
        typeName: 'DeleteFeatureChange',
      }),
    )
  })
})
