import { Assembly } from '@apollo-annotation/schemas'
import { getModelToken } from '@nestjs/mongoose'
import { Test, type TestingModule } from '@nestjs/testing'

import { ChecksService } from '../checks/checks.service.js'
import { FeaturesService } from '../features/features.service.js'
import { RefSeqsService } from '../refSeqs/refSeqs.service.js'

import { AssembliesService } from './assemblies.service.js'

describe('AssembliesService', () => {
  let service: AssembliesService

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AssembliesService,
        { provide: getModelToken(Assembly.name), useValue: {} },
        { provide: ChecksService, useValue: {} },
        { provide: FeaturesService, useValue: {} },
        { provide: RefSeqsService, useValue: {} },
      ],
    }).compile()

    service = module.get<AssembliesService>(AssembliesService)
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })
})
