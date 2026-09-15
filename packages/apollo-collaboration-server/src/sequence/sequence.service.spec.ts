import { RefSeq } from '@apollo-annotation/schemas'
import { getModelToken } from '@nestjs/mongoose'
import { Test, type TestingModule } from '@nestjs/testing'

import { AssembliesService } from '../assemblies/assemblies.service.js'
import { JBrowseConfigService } from '../jbrowse/jbrowseConfig.service.js'

import { SequenceService } from './sequence.service.js'

describe('SequenceService', () => {
  let service: SequenceService

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SequenceService,
        { provide: getModelToken(RefSeq.name), useValue: {} },
        { provide: AssembliesService, useValue: {} },
        { provide: JBrowseConfigService, useValue: {} },
      ],
    }).compile()

    service = module.get<SequenceService>(SequenceService)
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })
})
