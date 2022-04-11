import { Test, TestingModule } from '@nestjs/testing'

import { RefSeqChunksService } from './refSeqChunks.service'

describe('RefSeqChunksService', () => {
  let service: RefSeqChunksService

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [RefSeqChunksService],
    }).compile()

    service = module.get<RefSeqChunksService>(RefSeqChunksService)
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })
})
