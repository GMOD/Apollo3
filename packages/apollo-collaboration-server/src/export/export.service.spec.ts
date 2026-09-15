import { Assembly, Export, Feature, RefSeq } from '@apollo-annotation/schemas'
import { getModelToken } from '@nestjs/mongoose'
import { Test, type TestingModule } from '@nestjs/testing'

import { JBrowseConfigService } from '../jbrowse/jbrowseConfig.service.js'

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
        { provide: getModelToken(RefSeq.name), useValue: {} },
        { provide: JBrowseConfigService, useValue: {} },
      ],
    }).compile()

    service = module.get<ExportService>(ExportService)
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })
})
