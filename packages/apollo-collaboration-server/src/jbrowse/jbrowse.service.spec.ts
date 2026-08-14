import { JBrowseConfig } from '@apollo-annotation/schemas'
import { ConfigService } from '@nestjs/config'
import { getModelToken } from '@nestjs/mongoose'
import { Test, type TestingModule } from '@nestjs/testing'

import { AssembliesService } from '../assemblies/assemblies.service.js'
import { RefSeqsService } from '../refSeqs/refSeqs.service.js'

import { JBrowseService } from './jbrowse.service.js'

describe('JBrowseService', () => {
  let service: JBrowseService

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JBrowseService,
        { provide: AssembliesService, useValue: {} },
        { provide: RefSeqsService, useValue: {} },
        { provide: getModelToken(JBrowseConfig.name), useValue: {} },
        { provide: ConfigService, useValue: {} },
      ],
    }).compile()

    service = module.get<JBrowseService>(JBrowseService)
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })
})
