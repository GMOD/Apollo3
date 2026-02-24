import { Test, type TestingModule } from '@nestjs/testing'

import { RefSeqsService } from './refSeqs.service.js'

describe('RefSeqsService', () => {
  let service: RefSeqsService

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [RefSeqsService],
    }).compile()

    service = module.get<RefSeqsService>(RefSeqsService)
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })
})
