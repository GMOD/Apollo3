import { Test, TestingModule } from '@nestjs/testing'

import { OntologiesController } from './ontologies.controller'

describe('OntologiesController', () => {
  let controller: OntologiesController

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [OntologiesController],
    }).compile()

    controller = module.get<OntologiesController>(OntologiesController)
  })

  it('should be defined', () => {
    expect(controller).toBeDefined()
  })
})
