import { Test, TestingModule } from '@nestjs/testing'

import { RefSeqChunksController } from './refSeqChunks.controller'
import { RefSeqChunksService } from './refSeqChunks.service'

describe('RefSeqChunksController', () => {
  let controller: RefSeqChunksController

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RefSeqChunksController],
      providers: [RefSeqChunksService],
    }).compile()

    controller = module.get<RefSeqChunksController>(RefSeqChunksController)
  })

  it('should be defined', () => {
    expect(controller).toBeDefined()
  })
})
