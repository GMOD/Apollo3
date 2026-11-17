import { Test, type TestingModule } from '@nestjs/testing'

import { AssemblyAccessService } from '../assemblyAccess/assemblyAccess.service.js'

import { RefSeqsController } from './refSeqs.controller.js'
import { RefSeqsService } from './refSeqs.service.js'

describe('RefSeqsController', () => {
  let controller: RefSeqsController

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RefSeqsController],
      providers: [
        { provide: RefSeqsService, useValue: {} },
        { provide: AssemblyAccessService, useValue: {} },
      ],
    }).compile()

    controller = module.get<RefSeqsController>(RefSeqsController)
  })

  it('should be defined', () => {
    expect(controller).toBeDefined()
  })
})
