/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
import { beforeEach, describe, expect, it, jest } from '@jest/globals'
import { Test, type TestingModule } from '@nestjs/testing'

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
