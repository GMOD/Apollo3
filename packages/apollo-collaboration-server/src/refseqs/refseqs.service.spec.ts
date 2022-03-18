import { Test, TestingModule } from '@nestjs/testing'

import { RefseqsService } from './refseqs.service'

describe('RefseqsService', () => {
  let service: RefseqsService

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [RefseqsService],
    }).compile()

    service = module.get<RefseqsService>(RefseqsService)
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })
})
