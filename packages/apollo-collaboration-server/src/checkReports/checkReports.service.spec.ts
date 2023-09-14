import { Test, TestingModule } from '@nestjs/testing'

import { CheckReportsService } from './checkReports.service'

describe('CheckReportsService', () => {
  let service: CheckReportsService

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CheckReportsService],
    }).compile()

    service = module.get<CheckReportsService>(CheckReportsService)
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })
})
