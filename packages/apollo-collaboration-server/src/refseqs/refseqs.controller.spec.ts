import { Test, TestingModule } from '@nestjs/testing'

import { RefseqsController } from './refseqs.controller'

describe('RefseqsController', () => {
  let controller: RefseqsController

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RefseqsController],
    }).compile()

    controller = module.get<RefseqsController>(RefseqsController)
  })

  it('should be defined', () => {
    expect(controller).toBeDefined()
  })
})
