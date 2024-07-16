import { Test, TestingModule } from '@nestjs/testing'

import { JBrowseController } from './jbrowse.controller'

describe('JBrowseController', () => {
  let controller: JBrowseController

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [JBrowseController],
    }).compile()

    controller = module.get<JBrowseController>(JBrowseController)
  })

  it('should be defined', () => {
    expect(controller).toBeDefined()
  })
})
