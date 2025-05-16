import { Test, type TestingModule } from '@nestjs/testing'

import { AssembliesController } from './assemblies.controller'

describe('AssembliesController', () => {
  let controller: AssembliesController

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AssembliesController],
    }).compile()

    controller = module.get<AssembliesController>(AssembliesController)
  })

  it('should be defined', () => {
    expect(controller).toBeDefined()
  })
})
