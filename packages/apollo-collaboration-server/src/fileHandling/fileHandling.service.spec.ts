import { Test, TestingModule } from '@nestjs/testing'
import { FileHandlingService } from './fileHandling.service'

describe('FileHandlingService', () => {
  let service: FileHandlingService

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [FileHandlingService],
    }).compile()

    service = module.get<FileHandlingService>(FileHandlingService)
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })
})
