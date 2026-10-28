import { Feature, RefSeq } from '@apollo-annotation/schemas'
import { jest } from '@jest/globals'
import { getModelToken } from '@nestjs/mongoose'
import { Test, type TestingModule } from '@nestjs/testing'

import { ChecksService } from '../checks/checks.service.js'

import { FeaturesService } from './features.service.js'

describe('FeaturesService', () => {
  let service: FeaturesService
  const countDocuments = jest.fn(() => Promise.resolve(3))

  beforeEach(async () => {
    countDocuments.mockClear()
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FeaturesService,
        { provide: ChecksService, useValue: {} },
        { provide: getModelToken(Feature.name), useValue: { countDocuments } },
        { provide: getModelToken(RefSeq.name), useValue: {} },
      ],
    }).compile()

    service = module.get<FeaturesService>(FeaturesService)
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })

  it('counts features overlapping a range using min and max', async () => {
    const count = await service.getFeatureCount({
      refSeqId: 'refSeq1',
      start: 100,
      end: 200,
    })
    expect(count).toBe(3)
    expect(countDocuments).toHaveBeenCalledWith({
      status: 0,
      refSeq: 'refSeq1',
      min: { $lte: 200 },
      max: { $gte: 100 },
    })
  })
})
