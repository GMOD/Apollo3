import { Test, type TestingModule } from '@nestjs/testing'

import { ChangesController } from './changes.controller.js'
import { ChangesService } from './changes.service.js'

describe('ChangesController', () => {
  let controller: ChangesController

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ChangesController],
      providers: [ChangesService],
    }).compile()

    controller = module.get<ChangesController>(ChangesController)
  })

  it('should be defined', () => {
    expect(controller).toBeDefined()
  })
})
