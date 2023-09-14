import { Test, TestingModule } from '@nestjs/testing'

import { CheckReportsController } from './checkReports.controller'

describe('CheckReportsController', () => {
  let controller: CheckReportsController

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CheckReportsController],
    }).compile()

    controller = module.get<CheckReportsController>(CheckReportsController)
  })

  it('should be defined', () => {
    expect(controller).toBeDefined()
  })
})
