import { File, RefSeq, RefSeqChunk } from '@apollo-annotation/schemas'
import { getModelToken } from '@nestjs/mongoose'
import { Test, type TestingModule } from '@nestjs/testing'

import { SequenceService } from './sequence.service.js'

import { AssembliesService } from '../assemblies/assemblies.service.js'
import { FilesService } from '../files/files.service.js'

describe('SequenceService', () => {
  let service: SequenceService

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SequenceService,
        { provide: getModelToken(File.name), useValue: {} },
        { provide: FilesService, useValue: {} },
        { provide: getModelToken(RefSeqChunk.name), useValue: {} },
        { provide: getModelToken(RefSeq.name), useValue: {} },
        { provide: AssembliesService, useValue: {} },
      ],
    }).compile()

    service = module.get<SequenceService>(SequenceService)
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })
})
