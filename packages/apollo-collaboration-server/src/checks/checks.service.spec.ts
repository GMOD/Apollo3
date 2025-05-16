import { Test, type TestingModule } from '@nestjs/testing'

import { ChecksService } from './checks.service'

describe('ChecksService', () => {
  let service: ChecksService

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ChecksService],
    }).compile()

    service = module.get<ChecksService>(ChecksService)
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })
})
