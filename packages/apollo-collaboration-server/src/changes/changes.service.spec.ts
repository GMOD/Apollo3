import {
  Assembly,
  Change,
  Feature,
  RefSeq,
  RefSeqChunk,
} from '@apollo-annotation/schemas'
import { getModelToken } from '@nestjs/mongoose'
import { Test, type TestingModule } from '@nestjs/testing'

import { CountersService } from '../counters/counters.service.js'
import { MessagesService } from '../messages/messages.service.js'

import { ChangeHandlersService } from './changeHandlers.service.js'
import { ChangesService } from './changes.service.js'

describe('ChangesService', () => {
  let service: ChangesService

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChangesService,
        { provide: getModelToken(Feature.name), useValue: {} },
        { provide: getModelToken(Assembly.name), useValue: {} },
        { provide: getModelToken(RefSeq.name), useValue: {} },
        { provide: getModelToken(RefSeqChunk.name), useValue: {} },
        { provide: getModelToken(Change.name), useValue: {} },
        { provide: CountersService, useValue: {} },
        { provide: MessagesService, useValue: {} },
        { provide: ChangeHandlersService, useValue: {} },
      ],
    }).compile()

    service = module.get<ChangesService>(ChangesService)
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })
})
