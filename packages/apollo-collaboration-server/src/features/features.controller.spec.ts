import { Test, type TestingModule } from '@nestjs/testing'

import { FeaturesController } from './features.controller.js'
import { FeaturesService } from './features.service.js'

describe('FeaturesController', () => {
  let controller: FeaturesController

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [FeaturesController],
      providers: [{ provide: FeaturesService, useValue: {} }],
    }).compile()

    controller = module.get<FeaturesController>(FeaturesController)
  })

  it('should be defined', () => {
    expect(controller).toBeDefined()
  })
})
