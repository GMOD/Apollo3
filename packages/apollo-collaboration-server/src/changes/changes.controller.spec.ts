import { Test, type TestingModule } from '@nestjs/testing'

import { AssemblyAccessService } from '../assemblyAccess/assemblyAccess.service.js'

import { ChangesController } from './changes.controller.js'
import { ChangesService } from './changes.service.js'

describe('ChangesController', () => {
  let controller: ChangesController

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ChangesController],
      providers: [
        { provide: ChangesService, useValue: {} },
        { provide: AssemblyAccessService, useValue: {} },
      ],
    }).compile()

    controller = module.get<ChangesController>(ChangesController)
  })

  it('should be defined', () => {
    expect(controller).toBeDefined()
  })
})
