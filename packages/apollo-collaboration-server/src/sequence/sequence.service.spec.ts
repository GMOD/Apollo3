import { Test, type TestingModule } from '@nestjs/testing'

import { SequenceService } from './sequence.service.js'

describe('SequenceService', () => {
  let service: SequenceService

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SequenceService],
    }).compile()

    service = module.get<SequenceService>(SequenceService)
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })
})
