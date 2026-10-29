import { Feature, RefSeq } from '@apollo-annotation/schemas'
import { jest } from '@jest/globals'
import { getModelToken } from '@nestjs/mongoose'
import { Test, type TestingModule } from '@nestjs/testing'

import { ChecksService } from '../checks/checks.service.js'

import { FeaturesService } from './features.service.js'

describe('FeaturesService', () => {
  let service: FeaturesService
  const countDocuments = jest.fn(() => Promise.resolve(3))
  const aggregate = jest.fn()

  beforeEach(async () => {
    countDocuments.mockClear()
    aggregate.mockReset()
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FeaturesService,
        { provide: ChecksService, useValue: {} },
        {
          provide: getModelToken(Feature.name),
          useValue: { countDocuments, aggregate },
        },
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

  it('splits feature density bins by strand', async () => {
    // Bins of 100 over [0, 300): a forward feature over bins 0-2, a reverse
    // feature in bin 1, and an unstranded feature in bin 2
    aggregate.mockReturnValue(
      Promise.resolve([
        {
          count: [{ count: 3 }],
          firstBins: [
            { _id: { bin: 0, strand: 1 }, count: 1 },
            { _id: { bin: 1, strand: -1 }, count: 1 },
            { _id: { bin: 2, strand: null }, count: 1 },
          ],
          endBins: [
            { _id: { bin: 3, strand: 1 }, count: 1 },
            { _id: { bin: 2, strand: -1 }, count: 1 },
            { _id: { bin: 3, strand: null }, count: 1 },
          ],
        },
      ]),
    )
    const density = await service.getFeatureDensity(
      '0123456789abcdef01234567',
      0,
      300,
      100,
    )
    expect(density).toEqual({
      count: 3,
      start: 0,
      binSize: 100,
      bins: [1, 2, 2],
      strandBins: {
        forward: [1, 1, 1],
        reverse: [0, 1, 0],
        unstranded: [0, 0, 1],
      },
    })
  })
})
