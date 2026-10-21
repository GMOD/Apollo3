import { Test, type TestingModule } from '@nestjs/testing'

import { AssemblyAccessService } from '../assemblyAccess/assemblyAccess.service.js'

import { JBrowseController } from './jbrowse.controller.js'
import { JBrowseService } from './jbrowse.service.js'

describe('JBrowseController', () => {
  let controller: JBrowseController

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [JBrowseController],
      providers: [
        { provide: JBrowseService, useValue: {} },
        { provide: AssemblyAccessService, useValue: {} },
      ],
    }).compile()

    controller = module.get<JBrowseController>(JBrowseController)
  })

  it('should be defined', () => {
    expect(controller).toBeDefined()
  })
})
