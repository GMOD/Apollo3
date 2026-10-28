import { jest } from '@jest/globals'
import { BadRequestException } from '@nestjs/common'
import { Test, type TestingModule } from '@nestjs/testing'

import { FeaturesController } from './features.controller.js'
import { FeaturesService } from './features.service.js'

describe('FeaturesController', () => {
  let controller: FeaturesController
  const getFeatureDensity = jest.fn()

  beforeEach(async () => {
    getFeatureDensity.mockClear()
    const module: TestingModule = await Test.createTestingModule({
      controllers: [FeaturesController],
      providers: [
        { provide: FeaturesService, useValue: { getFeatureDensity } },
      ],
    }).compile()

    controller = module.get<FeaturesController>(FeaturesController)
  })

  it('should be defined', () => {
    expect(controller).toBeDefined()
  })

  it('parses feature density query parameters', () => {
    void controller.getFeatureDensity({
      refSeq: 'refSeq1',
      start: '100',
      end: '20100',
      binSize: '200',
    })
    expect(getFeatureDensity).toHaveBeenCalledWith('refSeq1', 100, 20_100, 200)
  })

  it.each([
    { refSeq: '', start: '0', end: '100', binSize: '10' },
    { refSeq: 'refSeq1', start: 'a', end: '100', binSize: '10' },
    { refSeq: 'refSeq1', start: '0', end: '100', binSize: '0' },
    { refSeq: 'refSeq1', start: '100', end: '0', binSize: '10' },
    { refSeq: 'refSeq1', start: '0', end: '1000000', binSize: '1' },
  ])('rejects invalid feature density request %o', (request) => {
    expect(() => controller.getFeatureDensity(request)).toThrow(
      BadRequestException,
    )
    expect(getFeatureDensity).not.toHaveBeenCalled()
  })
})
