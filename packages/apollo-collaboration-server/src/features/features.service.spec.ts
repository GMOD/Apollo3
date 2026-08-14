import { Feature, RefSeq } from '@apollo-annotation/schemas'
import { getModelToken } from '@nestjs/mongoose'
import { Test, type TestingModule } from '@nestjs/testing'

import { ChecksService } from '../checks/checks.service.js'

import { FeaturesService } from './features.service.js'

describe('FeaturesService', () => {
  let service: FeaturesService

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FeaturesService,
        { provide: ChecksService, useValue: {} },
        { provide: getModelToken(Feature.name), useValue: {} },
        { provide: getModelToken(RefSeq.name), useValue: {} },
      ],
    }).compile()

    service = module.get<FeaturesService>(FeaturesService)
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })
})
