import { Test, type TestingModule } from '@nestjs/testing'

import { AssemblyPermissionsController } from './assemblyPermissions.controller.js'
import { AssemblyPermissionsService } from './assemblyPermissions.service.js'

describe('AssemblyPermissionsController', () => {
  let controller: AssemblyPermissionsController

  const serviceMock = {
    find: jest.fn(),
    findByUser: jest.fn(),
    findByAssembly: jest.fn(),
    upsertPermission: jest.fn(),
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
