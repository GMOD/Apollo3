import {
  Assembly,
  Export,
  Feature,
  File,
  RefSeq,
  RefSeqChunk,
} from '@apollo-annotation/schemas'
import { jest } from '@jest/globals'
import { ConfigService } from '@nestjs/config'
import { getModelToken } from '@nestjs/mongoose'
import { Test, type TestingModule } from '@nestjs/testing'

import { ExportService } from './export.service.js'

describe('ExportService', () => {
  let service: ExportService

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExportService,
        { provide: getModelToken(Assembly.name), useValue: {} },
        { provide: getModelToken(Export.name), useValue: {} },
        { provide: getModelToken(Feature.name), useValue: {} },
        { provide: getModelToken(File.name), useValue: {} },
        { provide: getModelToken(RefSeq.name), useValue: {} },
        { provide: getModelToken(RefSeqChunk.name), useValue: {} },
        { provide: ConfigService, useValue: { get: jest.fn() } },
      ],
    }).compile()

    service = module.get<ExportService>(ExportService)
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })
})
