import { Test, type TestingModule } from '@nestjs/testing'

import { RefSeqsController } from './refSeqs.controller'
import { RefSeqsService } from './refSeqs.service'

describe('RefSeqsController', () => {
  let controller: RefSeqsController

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RefSeqsController],
      providers: [RefSeqsService],
    }).compile()

    controller = module.get<RefSeqsController>(RefSeqsController)
  })

  it('should be defined', () => {
    expect(controller).toBeDefined()
  })
})
