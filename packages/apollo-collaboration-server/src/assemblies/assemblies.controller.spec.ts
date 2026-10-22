import { Test, type TestingModule } from '@nestjs/testing'

import { AssemblyAccessService } from '../assemblyAccess/assemblyAccess.service.js'

import { AssembliesController } from './assemblies.controller.js'
import { AssembliesService } from './assemblies.service.js'

describe('AssembliesController', () => {
  let controller: AssembliesController

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AssembliesController],
      providers: [
        { provide: AssembliesService, useValue: {} },
        { provide: AssemblyAccessService, useValue: {} },
      ],
    }).compile()

    controller = module.get<AssembliesController>(AssembliesController)
  })

  it('should be defined', () => {
    expect(controller).toBeDefined()
  })
})
