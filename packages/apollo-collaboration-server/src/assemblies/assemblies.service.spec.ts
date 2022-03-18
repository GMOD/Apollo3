import { Test, TestingModule } from '@nestjs/testing'

import { AssembliesService } from './assemblies.service'

describe('AssembliesService', () => {
  let service: AssembliesService

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AssembliesService],
    }).compile()

    service = module.get<AssembliesService>(AssembliesService)
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })
})
