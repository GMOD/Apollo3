import { Test, type TestingModule } from '@nestjs/testing'

import { FilesService } from './files.service.js'

describe('FilesService', () => {
  let service: FilesService

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [FilesService],
    }).compile()

    service = module.get<FilesService>(FilesService)
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })
})
