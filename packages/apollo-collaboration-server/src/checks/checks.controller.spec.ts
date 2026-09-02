import { Test, type TestingModule } from '@nestjs/testing'

import { ChecksController } from './checks.controller.js'
import { ChecksService } from './checks.service.js'

describe('ChecksController', () => {
  let controller: ChecksController

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ChecksController],
      providers: [{ provide: ChecksService, useValue: {} }],
    }).compile()

    controller = module.get<ChecksController>(ChecksController)
  })

  it('should be defined', () => {
    expect(controller).toBeDefined()
  })
})
