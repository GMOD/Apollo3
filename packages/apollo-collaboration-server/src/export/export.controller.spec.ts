import { Test, type TestingModule } from '@nestjs/testing'

import { ExportController } from './export.controller.js'
import { ExportService } from './export.service.js'

describe('ExportController', () => {
  let controller: ExportController

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ExportController],
      providers: [{ provide: ExportService, useValue: {} }],
    }).compile()

    controller = module.get<ExportController>(ExportController)
  })

  it('should be defined', () => {
    expect(controller).toBeDefined()
  })
})
