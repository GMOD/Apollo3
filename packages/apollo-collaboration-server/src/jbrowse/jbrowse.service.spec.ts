import { Test, TestingModule } from '@nestjs/testing'

import { JBrowseService } from './jbrowse.service'

describe('JBrowseService', () => {
  let service: JBrowseService

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [JBrowseService],
    }).compile()

    service = module.get<JBrowseService>(JBrowseService)
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })
})
