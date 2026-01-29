import { Test, type TestingModule } from '@nestjs/testing'

import { ChangesService } from './changes.service.js'

describe('ChangesService', () => {
  let service: ChangesService

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ChangesService],
    }).compile()

    service = module.get<ChangesService>(ChangesService)
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })
})
