import { Check, CheckResult } from '@apollo-annotation/schemas'
import { getModelToken } from '@nestjs/mongoose'
import { Test, type TestingModule } from '@nestjs/testing'

import { RefSeqsService } from '../refSeqs/refSeqs.service.js'
import { SequenceService } from '../sequence/sequence.service.js'

import { ChecksService } from './checks.service.js'

describe('ChecksService', () => {
  let service: ChecksService

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChecksService,
        { provide: getModelToken(CheckResult.name), useValue: {} },
        { provide: RefSeqsService, useValue: {} },
        { provide: SequenceService, useValue: {} },
        { provide: getModelToken(Check.name), useValue: {} },
      ],
    }).compile()

    service = module.get<ChecksService>(ChecksService)
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })
})
