import { Test, TestingModule } from '@nestjs/testing'

import { OntologiesService } from './ontologies.service'

describe('OntologiesService', () => {
  let service: OntologiesService

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [OntologiesService],
    }).compile()

    service = module.get<OntologiesService>(OntologiesService)
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })
})
