import { Test, type TestingModule } from '@nestjs/testing'

import { SequenceController } from './sequence.controller.js'

describe('SequenceController', () => {
  let controller: SequenceController

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SequenceController],
    }).compile()

    controller = module.get<SequenceController>(SequenceController)
  })

  it('should be defined', () => {
    expect(controller).toBeDefined()
  })
})
