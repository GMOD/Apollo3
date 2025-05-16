import { Test, type TestingModule } from '@nestjs/testing'

import { ChecksController } from './checks.controller'

describe('ChecksController', () => {
  let controller: ChecksController

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ChecksController],
    }).compile()

    controller = module.get<ChecksController>(ChecksController)
  })

  it('should be defined', () => {
    expect(controller).toBeDefined()
  })
})
