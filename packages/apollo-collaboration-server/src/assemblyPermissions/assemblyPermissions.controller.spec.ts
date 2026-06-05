import { Test, type TestingModule } from '@nestjs/testing'
import { jest } from '@jest/globals'

import { AssemblyPermissionsController } from './assemblyPermissions.controller.js'
import { AssemblyPermissionsService } from './assemblyPermissions.service.js'

describe('AssemblyPermissionsController', () => {
  let controller: AssemblyPermissionsController

  const serviceMock = {
    find: jest.fn(),
    findByUser: jest.fn(),
    findEffectiveByUser: jest.fn(),
    findByAssembly: jest.fn(),
    upsertPermission: jest.fn(),
    findGroups: jest.fn(),
    createGroup: jest.fn(),
    deleteGroup: jest.fn(),
    findGroupMembershipsByUser: jest.fn(),
    findGroupMembershipsByGroup: jest.fn(),
    setGroupMembership: jest.fn(),
    findGroupPermissions: jest.fn(),
    upsertGroupPermission: jest.fn(),
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AssemblyPermissionsController],
      providers: [
        {
          provide: AssemblyPermissionsService,
          useValue: serviceMock,
        },
      ],
    }).compile()

    controller = module.get<AssemblyPermissionsController>(
      AssemblyPermissionsController,
    )
  })

  it('should be defined', () => {
    expect(controller).toBeDefined()
  })
})
